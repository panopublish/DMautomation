/**
 * tests/test-approval-flow.js
 * Validates the human approval queue, approval dispatch, and rejection lifecycle.
 */

const assert = require("assert");
const stateStore = require("../src/storage/state-store");
const approvalManager = require("../src/approval/approval-manager");

async function runTest() {
  console.log("------------------------------------------------------------");
  console.log("RUNNING: test-approval-flow (Human Review & Approvals)");
  console.log("------------------------------------------------------------");

  const timestamp = Date.now();
  const turnId = "turn_approval_test_" + timestamp;
  const username = "tour_maker_" + timestamp;

  // 1. Add item to pending queue
  stateStore.addPendingApproval(turnId, {
    username,
    incomingText: "Can I embed the tour on my WordPress website?",
    proposedReply: "Yes, PanoPublish gives you an iframe embed code ready to paste into WordPress.",
    intent: "HOW_TO",
    leadTemperature: "WARM",
    reason: "WordPress embedding inquiry"
  });

  const pendingList = stateStore.getPendingApprovals();
  const queuedItem = pendingList.find(p => p.dmTurnId === turnId);
  assert.ok(queuedItem, "Item must be queued in pending approvals");
  assert.strictEqual(queuedItem.status, "PENDING_APPROVAL");
  console.log("✓ PASS: Item successfully queued for human approval.");

  // 2. Approve item (in simulation mode)
  const approvalResult = await approvalManager.approveItem(turnId, null, { forceDryRun: true });
  assert.strictEqual(approvalResult.success, true);
  assert.strictEqual(approvalResult.sendResult?.dryRun, true, "Must execute in dry-run mode safely");

  // 3. Verify item is removed from pending queue
  const afterPending = stateStore.getPendingApprovals();
  assert.strictEqual(afterPending.some(p => p.dmTurnId === turnId), false, "Approved item must leave pending queue");
  console.log("✓ PASS: Approved item dispatched safely and cleared from pending queue.");

  // 4. Test rejection flow
  const rejectTurnId = "turn_reject_test_202";
  stateStore.addPendingApproval(rejectTurnId, {
    username: "spammer_account",
    incomingText: "Crypto investment offer",
    proposedReply: "Not interested",
    intent: "SPAM",
    leadTemperature: "NOT_A_LEAD",
    reason: "Spam message"
  });

  const rejectResult = approvalManager.rejectItem(rejectTurnId);
  assert.strictEqual(rejectResult.success, true);
  const checkRejected = stateStore.getPendingApproval(rejectTurnId);
  assert.strictEqual(checkRejected, null, "Rejected item must not remain pending");
  console.log("✓ PASS: Rejected item properly handled.");

  console.log("------------------------------------------------------------");
  console.log("✓ ALL APPROVAL FLOW TESTS PASSED SUCCESSFULLY");
  console.log("------------------------------------------------------------\n");
}

module.exports = runTest;
if (require.main === module) {
  runTest().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
  });
}
