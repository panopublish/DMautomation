/**
 * src/safety/duplicate-guard.js
 * Multi-layer duplicate protection engine for PanoPublish Instagram DM automation.
 * Generates deterministic turn IDs and prevents sending duplicate or repetitive responses.
 */

const crypto = require("crypto");
const stateStore = require("../storage/state-store");
const logger = require("../logging/logger");

class DuplicateGuard {
  /**
   * Generates deterministic turn ID using:
   * account + conversationId + sender + messageText + context
   */
  generateTurnId(account, convId, sender, messageText, context = "") {
    const cleanAccount = String(account || "default").trim().toLowerCase();
    const cleanConv = String(convId || "").trim().toLowerCase();
    const cleanSender = String(sender || "").trim().toLowerCase();
    const cleanText = String(messageText || "").trim().toLowerCase();
    const cleanCtx = String(context || "").trim().toLowerCase();

    const payload = `${cleanAccount}::${cleanConv}::${cleanSender}::${cleanText}::${cleanCtx}`;
    const hash = crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
    return `dm_turn_${cleanSender}_${hash}`;
  }

  hashText(text) {
    return crypto
      .createHash("sha256")
      .update(String(text || "").trim().toLowerCase())
      .digest("hex")
      .slice(0, 16);
  }

  /**
   * Calculates word overlap similarity (Jaccard index) between two text strings.
   */
  calculateSimilarity(text1, text2) {
    const t1 = String(text1 || "").trim().toLowerCase();
    const t2 = String(text2 || "").trim().toLowerCase();
    if (t1 === t2) return 1.0;
    if (!t1 || !t2) return 0.0;

    const words1 = new Set(t1.split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(t2.split(/\s+/).filter(w => w.length > 2));
    if (words1.size === 0 || words2.size === 0) return 0.0;

    let intersection = 0;
    for (const w of words1) {
      if (words2.has(w)) intersection++;
    }
    const union = new Set([...words1, ...words2]).size;
    return union === 0 ? 0.0 : intersection / union;
  }

  /**
   * Verifies if this incoming message turn has already been handled.
   */
  hasTurnBeenHandled(dmTurnId) {
    return stateStore.hasHandledTurn(dmTurnId);
  }

  /**
   * Conversation-level repetition guard:
   * Prevents sending exact identical or semantically repetitive (>75% similarity)
   * messages within the same conversation thread.
   */
  canSendInConversation(usernameOrThreadId, proposedReply, account) {
    if (!usernameOrThreadId || !proposedReply) return { allowed: true };
    const recent = stateStore.getRecentOutgoingMessages(usernameOrThreadId, 5, account);
    const cleanProposed = String(proposedReply).trim().toLowerCase();

    for (const prev of recent) {
      const cleanPrev = String(prev).trim().toLowerCase();
      if (cleanPrev === cleanProposed) {
        return {
          allowed: false,
          reason: `Exact identical response was already sent recently in this conversation. Repetition blocked.`
        };
      }
      const sim = this.calculateSimilarity(cleanProposed, cleanPrev);
      if (sim >= 0.75) {
        return {
          allowed: false,
          reason: `Semantically repetitive message (${Math.round(sim * 100)}% similarity) was already sent recently. Repetition blocked.`
        };
      }
    }
    return { allowed: true };
  }

  /**
   * Comprehensive pre-send duplicate check.
   */
  canExecuteReply(params) {
    const { account, convId, sender, incomingText, proposedReply } = params;

    // 1. Check deterministic turn ID
    const turnId = this.generateTurnId(account, convId, sender, incomingText);
    if (this.hasTurnBeenHandled(turnId)) {
      return {
        allowed: false,
        turnId,
        reason: `Message turn ${turnId} has already been processed and replied to.`
      };
    }

    // 2. Check conversation repetition
    const convCheck = this.canSendInConversation(convId || sender, proposedReply, account);
    if (!convCheck.allowed) {
      return {
        allowed: false,
        turnId,
        reason: convCheck.reason
      };
    }

    return { allowed: true, turnId };
  }
}

const duplicateGuard = new DuplicateGuard();
module.exports = duplicateGuard;
