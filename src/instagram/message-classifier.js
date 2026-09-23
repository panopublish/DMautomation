/**
 * src/instagram/message-classifier.js
 * Multi-signal detector distinguishing INCOMING messages from OWN OUTGOING messages.
 * Never allows the system to reply to its own outgoing messages.
 */

const stateStore = require("../storage/state-store");
const logger = require("../logging/logger");

const OUTGOING_PREFIX_PATTERNS = [
  /^you\s*:/i,
  /^you sent/i,
  /^you shared/i,
  /^you replied/i,
  /^you:\s*/i,
  /^seen\b/i
];

class MessageClassifier {
  /**
   * Fast text pattern check for outgoing indicators.
   */
  hasOutgoingTextMarkers(messageText) {
    const text = String(messageText || "").trim();
    for (const pattern of OUTGOING_PREFIX_PATTERNS) {
      if (pattern.test(text)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Compares message content against our recent outgoing messages store.
   */
  matchesRecentOutgoing(usernameOrThreadId, messageText, account) {
    if (!messageText) return false;
    const recent = stateStore.getRecentOutgoingMessages(usernameOrThreadId, 10, account);
    const clean = String(messageText).trim().toLowerCase();

    return recent.some(prev => {
      const cleanPrev = String(prev).trim().toLowerCase();
      // Match exact or prefix overlap
      return (
        clean === cleanPrev ||
        clean.startsWith(cleanPrev.slice(0, 30)) ||
        cleanPrev.startsWith(clean.slice(0, 30))
      );
    });
  }

  /**
   * Evaluates message context across DOM markers, text prefixes, and state memory.
   *
   * @param {Object} candidate - {
   *   text: string,
   *   isDomOutgoing?: boolean,
   *   senderName?: string,
   *   convId: string,
   *   account?: string
   * }
   * @returns {{
   *   direction: "INCOMING" | "OUTGOING" | "UNCERTAIN",
   *   canReply: boolean,
   *   humanReviewRequired: boolean,
   *   reason: string
   * }}
   */
  classifyMessage(candidate) {
    const { text, isDomOutgoing, senderName, convId, account } = candidate;
    const cleanText = String(text || "").trim();

    // 1. Explicit DOM outgoing signal
    if (isDomOutgoing === true) {
      return {
        direction: "OUTGOING",
        canReply: false,
        humanReviewRequired: false,
        reason: "DOM layout indicates outgoing message bubble (aligned right / sender indicator)."
      };
    }

    // 2. Outgoing text patterns ("You sent", etc.)
    if (this.hasOutgoingTextMarkers(cleanText)) {
      return {
        direction: "OUTGOING",
        canReply: false,
        humanReviewRequired: false,
        reason: "Message begins with outgoing indicator ('You sent', 'You replied', etc.)."
      };
    }

    // 3. Match against recent outgoing responses in state store
    if (this.matchesRecentOutgoing(convId || senderName, cleanText, account)) {
      return {
        direction: "OUTGOING",
        canReply: false,
        humanReviewRequired: false,
        reason: "Message matches recent outgoing response recorded in state store. Awaiting user reply."
      };
    }

    // 4. Check if sender name indicates self
    if (senderName && /^(you|self|me)$/i.test(senderName.trim())) {
      return {
        direction: "OUTGOING",
        canReply: false,
        humanReviewRequired: false,
        reason: "Sender name explicitly identified as self/you."
      };
    }

    // 5. If DOM explicitly reported incoming (left-aligned / other user avatar)
    if (isDomOutgoing === false) {
      return {
        direction: "INCOMING",
        canReply: true,
        humanReviewRequired: false,
        reason: "DOM structure and text confirm genuine incoming message from contact."
      };
    }

    // 6. Ambiguous / uncertain cases: SAFETY FIRST
    // If we have text but no clear indicator whether it's incoming or outgoing, NEVER reply automatically
    logger.warn(`[CLASSIFIER] Message direction is ambiguous for conversation ${convId}. Escalating.`);
    return {
      direction: "UNCERTAIN",
      canReply: false,
      humanReviewRequired: true,
      reason: "Direction could not be definitively determined. Escalated to prevent self-replies."
    };
  }
}

const messageClassifier = new MessageClassifier();
module.exports = messageClassifier;
