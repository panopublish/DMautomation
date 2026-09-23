/**
 * tests/test-ai-engine.js
 * Validates AI schema parsing, sensitive topic escalation, and PanoPublish intent reasoning.
 */

const assert = require("assert");
const aiDecisionEngine = require("../src/ai/ai-decision-engine");

async function runTest() {
  console.log("------------------------------------------------------------");
  console.log("RUNNING: test-ai-engine (Schema & Escalation Validation)");
  console.log("------------------------------------------------------------");

  // 1. Sensitive Escalation Test (Refund request)
  const refundCheck = await aiDecisionEngine.evaluateDm({
    username: "angry_user",
    incomingMessage: "I want an immediate refund or chargeback for my subscription!"
  });
  assert.strictEqual(refundCheck.human_review_required, true, "Refund must trigger human review");
  assert.strictEqual(refundCheck.should_reply, false, "Must NOT auto-reply to refund/dispute");
  console.log("✓ PASS: Refund dispute escalated to human review.");

  // 2. Sensitive Escalation Test (Legal complaint)
  const legalCheck = await aiDecisionEngine.evaluateDm({
    username: "legal_claimant",
    incomingMessage: "We will take legal action and sue you for copyright infringement."
  });
  assert.strictEqual(legalCheck.human_review_required, true, "Legal threat must trigger human review");
  assert.strictEqual(legalCheck.should_reply, false);
  console.log("✓ PASS: Legal complaint escalated to human review.");

  // 3. Pricing Request Test
  const pricingCheck = await aiDecisionEngine.evaluateDm({
    username: "prospect_studio",
    incomingMessage: "How much does PanoPublish cost per month or per tour?"
  });
  assert.strictEqual(pricingCheck.intent, "PRICING_REQUEST");
  assert.strictEqual(pricingCheck.should_reply, true);
  assert.ok(pricingCheck.response.includes("$5.99") || pricingCheck.response.includes("₹100"), "Response must mention plans or pay-as-you-go");
  console.log("✓ PASS: Pricing intent classified with correct knowledge base pricing.");

  // 4. Camera Context Test (Insta360 X3)
  const cameraCheck = await aiDecisionEngine.evaluateDm({
    username: "tour_creator",
    incomingMessage: "Hey, I have an Insta360 X3 and I want to start selling virtual tours."
  });
  assert.strictEqual(cameraCheck.should_reply, true);
  assert.ok(cameraCheck.response.toLowerCase().includes("insta360"), "Response must acknowledge user camera");
  console.log("✓ PASS: Insta360 camera inquiry generated natural conversational advice.");

  // 5. Schema Validation Test (valid JSON parsing)
  const rawSample = {
    intent: "GOOGLE_STREET_VIEW_PHOTOGRAPHER",
    lead_temperature: "HOT",
    user_type: "STREET_VIEW_PRO",
    conversation_stage: "EDUCATION",
    should_reply: true,
    human_review_required: false,
    reason: "Valid street view workflow",
    response: "Yes, you can publish straight to Google Street View from PanoPublish."
  };
  const normalized = aiDecisionEngine.validateAndNormalizeResponse(rawSample);
  assert.strictEqual(normalized.intent, "GOOGLE_STREET_VIEW_PHOTOGRAPHER");
  assert.strictEqual(normalized.lead_temperature, "HOT");
  console.log("✓ PASS: Structured JSON output schema normalized accurately.");

  console.log("------------------------------------------------------------");
  console.log("✓ ALL AI ENGINE TESTS PASSED SUCCESSFULLY");
  console.log("------------------------------------------------------------\n");
}

module.exports = runTest;
if (require.main === module) {
  runTest().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
  });
}
