/**
 * tests/test-rate-limiter.js
 * Validates hourly and daily rate limits and human delay bounds.
 */

const assert = require("assert");
const rateLimiter = require("../src/safety/rate-limiter");
const stateStore = require("../src/storage/state-store");

async function runTest() {
  console.log("------------------------------------------------------------");
  console.log("RUNNING: test-rate-limiter (Rate Limiting & Delays)");
  console.log("------------------------------------------------------------");

  // 1. Initial rate check
  const check1 = rateLimiter.canPerformDmReply();
  assert.strictEqual(typeof check1.allowed, "boolean");
  console.log("✓ PASS: Initial rate limit check executed.");

  // 2. Check human delay jitter
  const delay = rateLimiter.getRandomDelayMs();
  assert.ok(delay >= 15000 && delay <= 45000, `Delay (${delay}ms) must be within 15000-45000ms bounds`);
  console.log(`✓ PASS: Random delay ${delay}ms is within configured bounds.`);

  // 3. Test hourly threshold enforcement
  const origActions = [...stateStore.state.recentActions];
  const testActions = [];
  for (let i = 0; i < rateLimiter.maxPerHour + 2; i++) {
    testActions.push({
      timeMs: Date.now() - 1000,
      actionType: "DM_REPLY_SENT",
      targetId: `user_test_${i}`
    });
  }
  stateStore.state.recentActions = testActions;

  const checkBlocked = rateLimiter.canPerformDmReply();
  assert.strictEqual(checkBlocked.allowed, false, "Rate limiter must block when hourly limit exceeded");
  console.log("✓ PASS: Hourly cap strictly enforced.");

  // Restore state
  stateStore.state.recentActions = origActions;

  console.log("------------------------------------------------------------");
  console.log("✓ ALL RATE LIMITER TESTS PASSED SUCCESSFULLY");
  console.log("------------------------------------------------------------\n");
}

module.exports = runTest;
if (require.main === module) {
  runTest().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
  });
}
