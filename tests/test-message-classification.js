/**
 * tests/test-message-classification.js
 * CRITICAL TEST: Verifies that the system NEVER replies to its own outgoing messages.
 */

const assert = require("assert");
const messageClassifier = require("../src/instagram/message-classifier");
const stateStore = require("../src/storage/state-store");

async function runTest() {
  console.log("------------------------------------------------------------");
  console.log("RUNNING: test-message-classification (Self-Reply Prevention)");
  console.log("------------------------------------------------------------");

  const testUser = "test_virtual_tour_user_1";
  const convId = "test_thread_123";

  // 1. Test "You sent" text pattern
  const res1 = messageClassifier.classifyMessage({
    text: "You sent: Hi! PanoPublish helps connect 360 scenes easily.",
    isDomOutgoing: undefined,
    senderName: testUser,
    convId
  });
  assert.strictEqual(res1.direction, "OUTGOING", "Must detect 'You sent' as OUTGOING");
  assert.strictEqual(res1.canReply, false, "Must NOT be allowed to reply to own outgoing message");
  console.log("✓ PASS: 'You sent' prefix correctly blocked from reply.");

  // 2. Test explicit DOM outgoing indicator (e.g. right-aligned bubble)
  const res2 = messageClassifier.classifyMessage({
    text: "Here is how you can publish to Google Street View.",
    isDomOutgoing: true,
    senderName: testUser,
    convId
  });
  assert.strictEqual(res2.direction, "OUTGOING", "DOM outgoing bubble must be flagged as OUTGOING");
  assert.strictEqual(res2.canReply, false, "Must NOT reply to DOM-identified outgoing bubble");
  console.log("✓ PASS: DOM outgoing flex indicator correctly blocked from reply.");

  // 3. Test state-store match against recently sent message
  stateStore.recordOutgoingMessage(convId, "An Insta360 X3 is great for virtual tours.", "SENT_VERIFIED");
  const res3 = messageClassifier.classifyMessage({
    text: "An Insta360 X3 is great for virtual tours.",
    isDomOutgoing: undefined,
    senderName: testUser,
    convId
  });
  assert.strictEqual(res3.direction, "OUTGOING", "Must detect message matching recent outgoing response");
  assert.strictEqual(res3.canReply, false, "Must NOT reply when last message matches our recent response");
  console.log("✓ PASS: Match against recent outgoing state correctly blocked from reply.");

  // 4. Test sender name is "You" or "Self"
  const res4 = messageClassifier.classifyMessage({
    text: "Checking in on your project",
    isDomOutgoing: undefined,
    senderName: "You",
    convId
  });
  assert.strictEqual(res4.direction, "OUTGOING", "Sender 'You' must be flagged OUTGOING");
  assert.strictEqual(res4.canReply, false);
  console.log("✓ PASS: Sender 'You' blocked from reply.");

  // 5. Test genuine incoming message from customer
  const res5 = messageClassifier.classifyMessage({
    text: "Can I use PanoPublish for Google Street View with an Insta360?",
    isDomOutgoing: false,
    senderName: testUser,
    convId
  });
  assert.strictEqual(res5.direction, "INCOMING", "Genuine message must be flagged INCOMING");
  assert.strictEqual(res5.canReply, true, "Must allow reply to genuine incoming message");
  console.log("✓ PASS: Genuine incoming message correctly classified as INCOMING and allowed.");

  // 6. Test ambiguous message without clear markers -> must escalate
  const res6 = messageClassifier.classifyMessage({
    text: "ok sounds good",
    isDomOutgoing: undefined,
    senderName: testUser,
    convId: "unseen_thread_999"
  });
  assert.strictEqual(res6.direction, "UNCERTAIN");
  assert.strictEqual(res6.canReply, false);
  assert.strictEqual(res6.humanReviewRequired, true);
  console.log("✓ PASS: Ambiguous direction safely escalated to human review.");

  console.log("------------------------------------------------------------");
  console.log("✓ ALL SELF-REPLY TESTS PASSED SUCCESSFULLY");
  console.log("------------------------------------------------------------\n");
}

module.exports = runTest;
if (require.main === module) {
  runTest().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
  });
}
