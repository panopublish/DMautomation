/**
 * tests/test-action-verifier.js
 * Validates DOM verification logic against simulated page contexts.
 */

const assert = require("assert");
const actionVerifier = require("../src/safety/action-verifier");

async function runTest() {
  console.log("------------------------------------------------------------");
  console.log("RUNNING: test-action-verifier (DOM Bubble Verification)");
  console.log("------------------------------------------------------------");

  // 1. Mock page simulating successful message appearance outside draft composer
  const mockSuccessPage = {
    url: () => "https://www.instagram.com/direct/t/123456789/",
    title: async () => "Direct Chat",
    evaluate: async (fn, arg) => {
      // Simulate DOM check where snippet is confirmed outside composer
      return { verified: true, tagName: "DIV", className: "message-bubble" };
    }
  };

  const res1 = await actionVerifier.verifyOutgoingDm(mockSuccessPage, "PanoPublish supports Street View publishing", {
    timeoutMs: 3000,
    targetId: "test_thread"
  });
  assert.strictEqual(res1.verified, true, "Must verify presence of message in DOM");
  assert.strictEqual(res1.state, "SENT_VERIFIED");
  console.log("✓ PASS: Permanent DOM chat bubble correctly verified as SENT_VERIFIED.");

  // 2. Mock page simulating platform error
  const mockErrorPage = {
    url: () => "https://www.instagram.com/direct/t/123456789/",
    title: async () => "Direct Chat",
    evaluate: async (fn, arg) => {
      return { verified: false, error: "Action blocked by Instagram" };
    }
  };

  const res2 = await actionVerifier.verifyOutgoingDm(mockErrorPage, "Sample message", {
    timeoutMs: 2000,
    targetId: "test_thread_err"
  });
  assert.strictEqual(res2.verified, false);
  assert.strictEqual(res2.state, "SEND_FAILED");
  console.log("✓ PASS: Platform error alert properly caught and marked as SEND_FAILED.");

  console.log("------------------------------------------------------------");
  console.log("✓ ALL ACTION VERIFIER TESTS PASSED SUCCESSFULLY");
  console.log("------------------------------------------------------------\n");
}

module.exports = runTest;
if (require.main === module) {
  runTest().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
  });
}
