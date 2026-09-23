/**
 * src/storage/state-store.js
 * Persistent atomic state storage for PanoPublish DM Automation.
 * Tracks conversations, multi-turn messages, lead scoring, approval queue, and action audits.
 */

const fs = require("fs");
const path = require("path");
const CONFIG = require("../../config");
const logger = require("../logging/logger");

const DEFAULT_STATE = {
  version: "1.0.0",
  lastUpdated: new Date().toISOString(),
  conversations: {},       // key: "instagram:account:username" or "instagram:threadId"
  pendingApprovals: {},    // key: dmTurnId -> pending action details
  handledTurns: {},        // key: dmTurnId -> boolean/metadata
  recentActions: [],       // history of actions
  stats: {
    total_conversations_scanned: 0,
    total_incoming_messages: 0,
    total_ai_analyzed: 0,
    total_pending_approval: 0,
    total_approved: 0,
    total_rejected: 0,
    total_replies_sent: 0,
    total_human_review_required: 0
  }
};

class StateStore {
  constructor(filePath = path.join(CONFIG.DATA_DIR, "state.json")) {
    this.filePath = filePath;
    this.state = this.loadState();
  }

  loadState() {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, "utf8");
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_STATE,
          ...parsed,
          conversations: parsed.conversations || {},
          pendingApprovals: parsed.pendingApprovals || {},
          handledTurns: parsed.handledTurns || {},
          recentActions: parsed.recentActions || [],
          stats: { ...DEFAULT_STATE.stats, ...(parsed.stats || {}) }
        };
      } catch (err) {
        logger.error(`Error parsing state file ${this.filePath}, initializing fresh state`, err);
        return JSON.parse(JSON.stringify(DEFAULT_STATE));
      }
    }
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  saveState() {
    try {
      this.state.lastUpdated = new Date().toISOString();
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tempPath = `${this.filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 7)}`;
      fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2), "utf8");
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      logger.error(`Failed to save state to ${this.filePath}`, err);
    }
  }

  // --- CONVERSATION MEMORY ---

  getConversationKey(usernameOrThreadId, account = CONFIG.DEFAULT_ACCOUNT_ID) {
    const clean = String(usernameOrThreadId || "").trim().toLowerCase();
    return `instagram:${account}:${clean}`;
  }

  getConversation(usernameOrThreadId, account = CONFIG.DEFAULT_ACCOUNT_ID) {
    const key = this.getConversationKey(usernameOrThreadId, account);
    return this.state.conversations[key] || null;
  }

  saveConversation(data, account = CONFIG.DEFAULT_ACCOUNT_ID) {
    const id = data.threadId || data.username;
    if (!id) return null;
    const key = this.getConversationKey(id, account);
    const existing = this.state.conversations[key] || {};

    const updated = {
      platform: "instagram",
      account,
      username: data.username || existing.username || id,
      threadId: data.threadId || existing.threadId || id,
      timestamps: {
        createdAt: existing.timestamps?.createdAt || new Date().toISOString(),
        lastActiveAt: new Date().toISOString()
      },
      detectedIntent: data.detectedIntent || existing.detectedIntent || "DISCOVERY",
      leadTemperature: data.leadTemperature || existing.leadTemperature || "COLD",
      userType: data.userType || existing.userType || "UNKNOWN",
      productInterest: data.productInterest || existing.productInterest || "GENERAL",
      conversationStage: data.conversationStage || existing.conversationStage || "DISCOVERY",
      panopublishIntroduced: Boolean(data.panopublishIntroduced ?? existing.panopublishIntroduced),
      pricingDiscussed: Boolean(data.pricingDiscussed ?? existing.pricingDiscussed),
      tutorialShared: Boolean(data.tutorialShared ?? existing.tutorialShared),
      signupDiscussed: Boolean(data.signupDiscussed ?? existing.signupDiscussed),
      lastAiResponse: data.lastAiResponse || existing.lastAiResponse || null,
      lastIncomingText: data.lastIncomingText || existing.lastIncomingText || null,
      pendingApproval: Boolean(data.pendingApproval ?? existing.pendingApproval),
      actionStatus: data.actionStatus || existing.actionStatus || "IDLE",
      ...existing,
      ...data,
      incomingMessages: data.incomingMessages || existing.incomingMessages || [],
      outgoingMessages: data.outgoingMessages || existing.outgoingMessages || []
    };

    this.state.conversations[key] = updated;
    this.saveState();
    return updated;
  }

  getRecentOutgoingMessages(usernameOrThreadId, limit = 5, account = CONFIG.DEFAULT_ACCOUNT_ID) {
    const conv = this.getConversation(usernameOrThreadId, account);
    if (!conv || !conv.outgoingMessages) return [];
    return conv.outgoingMessages.slice(-limit).map(m => typeof m === "string" ? m : m.text);
  }

  recordIncomingMessage(usernameOrThreadId, messageText, account = CONFIG.DEFAULT_ACCOUNT_ID) {
    const conv = this.getConversation(usernameOrThreadId, account) || {
      username: usernameOrThreadId,
      threadId: usernameOrThreadId
    };
    const incoming = conv.incomingMessages || [];
    incoming.push({
      text: messageText,
      timestamp: new Date().toISOString()
    });
    conv.incomingMessages = incoming;
    conv.lastIncomingText = messageText;
    this.state.stats.total_incoming_messages++;
    this.saveConversation(conv, account);
  }

  recordOutgoingMessage(usernameOrThreadId, messageText, verificationState = "SENT_VERIFIED", account = CONFIG.DEFAULT_ACCOUNT_ID) {
    const conv = this.getConversation(usernameOrThreadId, account) || {
      username: usernameOrThreadId,
      threadId: usernameOrThreadId
    };
    const outgoing = conv.outgoingMessages || [];
    outgoing.push({
      text: messageText,
      verificationState,
      timestamp: new Date().toISOString()
    });
    conv.outgoingMessages = outgoing;
    conv.lastOutgoingText = messageText;
    conv.actionStatus = verificationState;
    if (verificationState === "SENT_VERIFIED") {
      this.state.stats.total_replies_sent++;
    }
    this.saveConversation(conv, account);
  }

  // --- HANDLED TURNS & DUPLICATE PROTECTION ---

  hasHandledTurn(dmTurnId) {
    return Boolean(this.state.handledTurns[dmTurnId]);
  }

  recordHandledTurn(dmTurnId, meta = {}) {
    this.state.handledTurns[dmTurnId] = {
      handledAt: new Date().toISOString(),
      ...meta
    };
    this.saveState();
  }

  // --- APPROVAL QUEUE ---

  addPendingApproval(dmTurnId, approvalItem) {
    this.state.pendingApprovals[dmTurnId] = {
      dmTurnId,
      createdAt: new Date().toISOString(),
      status: "PENDING_APPROVAL",
      ...approvalItem
    };
    this.state.stats.total_pending_approval = Object.keys(this.state.pendingApprovals).length;
    this.saveState();
  }

  getPendingApprovals() {
    return Object.values(this.state.pendingApprovals).filter(item => item.status === "PENDING_APPROVAL");
  }

  getPendingApproval(dmTurnId) {
    return this.state.pendingApprovals[dmTurnId] || null;
  }

  resolveApproval(dmTurnId, resolution = "APPROVED", editedText = null) {
    const item = this.state.pendingApprovals[dmTurnId];
    if (item) {
      item.status = resolution;
      item.resolvedAt = new Date().toISOString();
      if (editedText) {
        item.proposedReply = editedText;
      }
      if (resolution === "APPROVED") {
        this.state.stats.total_approved++;
      } else if (resolution === "REJECTED") {
        this.state.stats.total_rejected++;
      }
      delete this.state.pendingApprovals[dmTurnId];
      this.state.stats.total_pending_approval = Object.keys(this.state.pendingApprovals).length;
      this.saveState();
      return item;
    }
    return null;
  }

  // --- ACTION AUDIT & SLIDING WINDOWS ---

  recordAction(actionType, targetId, details = {}) {
    const action = {
      timestamp: new Date().toISOString(),
      timeMs: Date.now(),
      actionType,
      targetId,
      ...details
    };
    this.state.recentActions.push(action);
    // Keep last 1000 actions
    if (this.state.recentActions.length > 1000) {
      this.state.recentActions = this.state.recentActions.slice(-1000);
    }
    this.saveState();
    return action;
  }

  getActionsInWindow(windowMs = 3600 * 1000) {
    const cutoff = Date.now() - windowMs;
    return this.state.recentActions.filter(a => a.timeMs >= cutoff);
  }
}

const stateStore = new StateStore();
module.exports = stateStore;
