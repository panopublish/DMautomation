/**
 * tests/test-duplicate-guard.js
 * CRITICAL TEST: Proves that the same incoming message cannot generate two replies,
 * and semantic repetition (>75%) within the conversation is blocked.
 */

const assert = require("assert");
const duplicateGuard = require("../src/safety/duplicate-guard");
const stateStore = require("../src/storage/state-store");

async function runTest() {
  console.log("------------------------------------------------------------");
  console.log("RUNNING: test-duplicate-guard (Duplicate & Repetition Guard)");
  console.log("------------------------------------------------------------");

  const account = "test-account-1";
  const convId = "thread_xyz_" + Date.now();
  const sender = "john_photographer_" + Date.now();
  const incomingMessage = "How do I upload multi-level floor plans?";
  const replyText = "You can create distinct floors in PanoPublish and add hotspots between them.";

  // 1. Initial check - must be allowed
  const check1 = duplicateGuard.canExecuteReply({
    account,
    convId,
    sender,
    incomingText: incomingMessage,
    proposedReply: replyText
  });
  assert.strictEqual(check1.allowed, true, "First reply attempt must be allowed");
  console.log(`✓ PASS: Initial turn ${check1.turnId} allowed.`);

  // 2. Record this turn as handled
  stateStore.recordHandledTurn(check1.turnId, {
    username: sender,
    responseText: replyText,
    status: "SENT_VERIFIED"
  });

  // 3. Second check with the exact same incoming message turn - MUST BE BLOCKED
  const check2 = duplicateGuard.canExecuteReply({
    account,
    convId,
    sender,
    incomingText: incomingMessage,
    proposedReply: replyText
  });
  assert.strictEqual(check2.allowed, false, "Second reply attempt to identical turn MUST be blocked");
  assert.strictEqual(check2.turnId, check1.turnId, "Deterministic turn IDs must match");
  console.log("✓ PASS: Duplicate turn attempt blocked successfully.");

  // 4. Test conversation-level semantic repetition (>75% similarity)
  const convUser = "sarah_realestate_" + Date.now();
  stateStore.recordOutgoingMessage(convUser, "Our starter plan is $5.99 per month for creating tours.", "SENT_VERIFIED", account);

  // Try to send almost identical message
  const repetitionCheck = duplicateGuard.canSendInConversation(
    convUser,
    "Our starter plan is $5.99 a month for creating tours.",
    account
  );
  assert.strictEqual(repetitionCheck.allowed, false, "Semantically identical message must be blocked");
  console.log(`✓ PASS: Repetitive message blocked by Jaccard similarity: ${repetitionCheck.reason}`);

  // 5. Distinct message in conversation should be allowed
  const freshCheck = duplicateGuard.canSendInConversation(
    convUser,
    "Would you like to know how multi-level navigation works for houses?",
    account
  );
  assert.strictEqual(freshCheck.allowed, true, "Distinct message must be allowed");
  console.log("✓ PASS: Fresh, non-repetitive message allowed.");

  console.log("------------------------------------------------------------");
  console.log("✓ ALL DUPLICATE GUARD TESTS PASSED SUCCESSFULLY");
  console.log("------------------------------------------------------------\n");
}

module.exports = runTest;
if (require.main === module) {
  runTest().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
  });
}
