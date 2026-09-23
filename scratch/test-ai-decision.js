const aiDecisionEngine = require('../src/ai/ai-decision-engine');

async function testAi() {
  const incoming = "Hey panopublish \n\nThanks for asking about our services! \n Our pricing starts at just ₹5,999/-\n We have different packages based on your business size:\n Starter Pack — ₹5,999/-\n (Best for small businesses & startups)\n Growth Pack — ₹14,999/-\n Enterprise Pack — Custom Pricing";

  const decision = await aiDecisionEngine.analyzeAndDecide({
    username: "360tvt",
    incomingText: incoming,
    conversationHistory: []
  });

  console.log('AI Decision:', JSON.stringify(decision, null, 2));
  process.exit(0);
}

testAi().catch(e => { console.error(e); process.exit(1); });
