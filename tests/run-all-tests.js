/**
 * tests/run-all-tests.js
 * Master automated test runner for PanoPublish DM Automation.
 */

const testMessageClassification = require("./test-message-classification");
const testDuplicateGuard = require("./test-duplicate-guard");
const testAiEngine = require("./test-ai-engine");
const testRateLimiter = require("./test-rate-limiter");
const testApprovalFlow = require("./test-approval-flow");
const testActionVerifier = require("./test-action-verifier");

async function main() {
  console.log("\n============================================================");
  console.log("       PANOPUBLISH AUTOMATION COMPLETE TEST SUITE");
  console.log("============================================================\n");

  const suites = [
    { name: "Self-Reply Prevention & Incoming/Outgoing Classification", fn: testMessageClassification },
    { name: "Duplicate Guard & Deterministic Turn Hashing", fn: testDuplicateGuard },
    { name: "AI Decision Engine & Sensitive Escalations", fn: testAiEngine },
    { name: "Rate Limiter & Human Delay Pacing", fn: testRateLimiter },
    { name: "Human Approval Flow & Queue Lifecycle", fn: testApprovalFlow },
    { name: "DOM Bubble Action Verifier", fn: testActionVerifier }
  ];

  let passed = 0;
  let failed = 0;

  for (const suite of suites) {
    try {
      await suite.fn();
      passed++;
    } catch (err) {
      console.error(`❌ FAILED: ${suite.name}`);
      console.error(err);
      failed++;
    }
  }

  console.log("============================================================");
  console.log(`TOTAL SUITES : ${suites.length}`);
  console.log(`PASSED       : ${passed}`);
  console.log(`FAILED       : ${failed}`);
  console.log("============================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("🎉 ALL AUTOMATED SAFETY & LOGIC VERIFICATIONS PASSED!\n");
    process.exit(0);
  }
}

main().catch(err => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
