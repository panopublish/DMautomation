/**
 * src/approval/approval-manager.js
 * Manages the human approval queue and execution transitions.
 */

const stateStore = require("../storage/state-store");
const instagramSender = require("../instagram/instagram-sender");
const logger = require("../logging/logger");

class ApprovalManager {
  getPending() {
    return stateStore.getPendingApprovals();
  }

  async approveItem(dmTurnId, editedText = null, options = {}) {
    const item = stateStore.getPendingApproval(dmTurnId);
    if (!item) {
      return { success: false, reason: "Item not found in pending approvals queue" };
    }

    const replyToSend = editedText || item.proposedReply;
    logger.info(`Approving DM turn ${dmTurnId} for @${item.username}`);

    // Send the message (respects DRY_RUN / POSTING_ENABLED settings or explicit options)
    const result = await instagramSender.sendMessage({
      threadIdOrUsername: item.threadId || item.username,
      messageText: replyToSend,
      account: item.account,
      incomingText: item.incomingText,
      ...options
    });

    const isSuccess = Boolean(result && result.success !== false);

    if (isSuccess) {
      stateStore.resolveApproval(dmTurnId, "APPROVED", replyToSend);
    } else {
      logger.warn(`Approval send failed for @${item.username}: ${result.error || result.reason}`);
    }

    return {
      success: isSuccess,
      reason: result.error || result.reason,
      item,
      sendResult: result
    };
  }

  rejectItem(dmTurnId, reason = "Rejected by operator") {
    const item = stateStore.getPendingApproval(dmTurnId);
    if (!item) {
      return { success: false, reason: "Item not found in pending approvals queue" };
    }

    logger.info(`Rejecting DM turn ${dmTurnId} for @${item.username}: ${reason}`);
    stateStore.resolveApproval(dmTurnId, "REJECTED");
    return { success: true, item };
  }
}

const approvalManager = new ApprovalManager();
module.exports = approvalManager;
