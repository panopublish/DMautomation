/**
 * src/ai/ai-decision-engine.js
 * Central AI Decision Engine for PanoPublish.
 * Analyzes incoming Instagram DMs, classifies lead intent, tracks conversation stage,
 * enforces safety/human review triggers, and generates natural, contextual replies.
 */

const knowledgeEngine = require("../knowledge/knowledge-engine");
const aiRuntime = require("./ai-runtime");
const logger = require("../logging/logger");

const VALID_INTENTS = new Set([
  "PRODUCT_INTEREST",
  "PRICING_REQUEST",
  "DEMO_REQUEST",
  "HOW_TO",
  "TECHNICAL_SUPPORT",
  "TRIAL_USER",
  "EXISTING_USER",
  "360_PHOTOGRAPHER",
  "GOOGLE_STREET_VIEW_PHOTOGRAPHER",
  "AGENCY",
  "REAL_ESTATE",
  "HOTEL",
  "RESTAURANT",
  "LOCAL_BUSINESS",
  "VIRTUAL_TOUR_CREATOR",
  "TOOL_COMPARISON",
  "MATTERPORT_ALTERNATIVE",
  "CLOUDPANO_ALTERNATIVE",
  "GENERAL_QUESTION",
  "NOT_RELEVANT",
  "SPAM",
  "HUMAN_REVIEW_REQUIRED"
]);

const VALID_TEMPERATURES = new Set(["HOT", "WARM", "COLD", "NOT_A_LEAD"]);

const SENSITIVE_ESCALATION_PATTERNS = [
  /\b(refund|chargeback|money back|dispute|billing issue|overcharged)\b/i,
  /\b(ban|banned|suspended|lockout|locked out|hacked|stolen account)\b/i,
  /\b(lawsuit|lawyer|legal action|gdpr|dmca|copyright infringement|sue you)\b/i,
  /\b(scam|fraud|thief|furious|disgusting|horrible service)\b/i,
  /\b(password|credit card|cvv|security vulnerability|exploit)\b/i
];

class AiDecisionEngine {
  /**
   * Fast rule-based escalation check for high-risk topics.
   */
  checkSensitiveEscalation(messageText) {
    const text = String(messageText || "").trim();
    for (const pattern of SENSITIVE_ESCALATION_PATTERNS) {
      if (pattern.test(text)) {
        return {
          requiresEscalation: true,
          reason: `Sensitive trigger detected matching ${pattern}`
        };
      }
    }
    return { requiresEscalation: false };
  }

  /**
   * Builds the comprehensive prompt for OpenAI-compatible LLM.
   */
  buildEvaluationPrompt(params) {
    const {
      username,
      incomingMessage,
      conversationHistory = [],
      conversationStage = "DISCOVERY",
      productIntroduced = false,
      pricingDiscussed = false
    } = params;

    const kbContext = knowledgeEngine.getAiContextString();

    const formattedHistory = conversationHistory
      .slice(-6)
      .map(m => `${m.sender || "User"}: "${m.text}"`)
      .join("\n");

    return `
${kbContext}

--- TASK ---
You are the AI assistant for PanoPublish. Evaluate the following incoming Instagram Direct Message from user @${username}.

CURRENT CONVERSATION STAGE: ${conversationStage}
PANOPUBLISH INTRODUCED BEFORE: ${productIntroduced}
PRICING DISCUSSED BEFORE: ${pricingDiscussed}

RECENT CONVERSATION HISTORY:
${formattedHistory || "(No prior messages in this conversation)"}

NEW INCOMING MESSAGE FROM @${username}:
"${incomingMessage}"

--- INSTRUCTIONS ---
1. Classify the user's intent. Must be one of:
   PRODUCT_INTEREST, PRICING_REQUEST, DEMO_REQUEST, HOW_TO, TECHNICAL_SUPPORT, TRIAL_USER, EXISTING_USER, 360_PHOTOGRAPHER, GOOGLE_STREET_VIEW_PHOTOGRAPHER, AGENCY, REAL_ESTATE, HOTEL, RESTAURANT, LOCAL_BUSINESS, VIRTUAL_TOUR_CREATOR, TOOL_COMPARISON, MATTERPORT_ALTERNATIVE, CLOUDPANO_ALTERNATIVE, GENERAL_QUESTION, NOT_RELEVANT, SPAM, HUMAN_REVIEW_REQUIRED.

2. Classify lead temperature:
   HOT (immediate client project / ready to publish / high intent)
   WARM (evaluating tools, asking questions, has 360 camera)
   COLD (casual interest, beginner, slow response)
   NOT_A_LEAD (spam, job applicant, irrelevant)

3. Identify user type (e.g. 360_PHOTOGRAPHER, STREET_VIEW_PRO, REAL_ESTATE, AGENCY, UNKNOWN).

4. Determine conversation stage:
   DISCOVERY, UNDERSTANDING_NEED, EDUCATION, PRODUCT_INTRODUCTION, TRIAL_SIGNUP, FOLLOW_UP, CONVERTED, CLOSED.

5. Decide if a reply should be generated:
   - If SPAM or NOT_RELEVANT: should_reply=false, response=null.
   - If payment dispute, ban, legal, abuse, or sensitive: human_review_required=true, should_reply=false, response=null.
   - Otherwise: should_reply=true.

6. Generate the response:
   - Conversational, human, empathetic, direct (2-3 sentences max).
   - DO NOT sound like a robotic sales chatbot ("Hello! We are PanoPublish, the best...").
   - Acknowledge their specific camera (Insta360, Ricoh, etc.) or client context if mentioned.
   - Do NOT quote pricing unless they explicitly asked about it.
   - Follow single useful link discipline (only include link if directly requested).

OUTPUT FORMAT: Strict JSON object only with NO markdown wrapping.
{
  "intent": "INTENT_NAME",
  "lead_temperature": "HOT|WARM|COLD|NOT_A_LEAD",
  "user_type": "USER_TYPE",
  "conversation_stage": "STAGE_NAME",
  "should_reply": true|false,
  "human_review_required": true|false,
  "reason": "Brief explanation of evaluation",
  "response": "The suggested reply text or null",
  "suggested_action": "EDUCATE|INTRODUCE_WORKFLOW|SHARE_LINK|ESCALATE_HUMAN|IGNORE"
}
`.trim();
  }

  /**
   * Validates and normalizes structured JSON output from LLM.
   */
  validateAndNormalizeResponse(rawJson) {
    if (!rawJson || typeof rawJson !== "object") {
      throw new Error("Invalid AI output: not an object");
    }

    const intent = VALID_INTENTS.has(rawJson.intent) ? rawJson.intent : "GENERAL_QUESTION";
    const temperature = VALID_TEMPERATURES.has(rawJson.lead_temperature) ? rawJson.lead_temperature : "WARM";
    const shouldReply = Boolean(rawJson.should_reply);
    const humanReview = Boolean(rawJson.human_review_required);
    const responseText = shouldReply && rawJson.response ? String(rawJson.response).trim() : null;

    return {
      intent,
      lead_temperature: temperature,
      user_type: String(rawJson.user_type || "UNKNOWN"),
      conversation_stage: String(rawJson.conversation_stage || "DISCOVERY"),
      should_reply: shouldReply,
      human_review_required: humanReview,
      reason: String(rawJson.reason || "Evaluated by AI"),
      response: responseText,
      suggested_action: String(rawJson.suggested_action || "REPLY")
    };
  }

  /**
   * Simulated heuristic response for local testing when AI_API_KEY is not configured.
   */
  generateSimulatedResponse(incomingMessage, username) {
    const text = incomingMessage.toLowerCase();

    if (text.includes("price") || text.includes("pricing") || text.includes("cost") || text.includes("how much")) {
      return {
        intent: "PRICING_REQUEST",
        lead_temperature: "HOT",
        user_type: "PROSPECT",
        conversation_stage: "EDUCATION",
        should_reply: true,
        human_review_required: false,
        reason: "User specifically asked about pricing options.",
        response: "Our subscription plans start at $5.99/mo for starters and $15.99/mo for active creators. We also have a flexible Pay As You Go option at ₹100 per extra tour credit that never expires. Are you looking to publish monthly or on a per-project basis?",
        suggested_action: "EDUCATE_PRICING"
      };
    }

    if (text.includes("street view") || text.includes("google maps") || text.includes("blue line")) {
      return {
        intent: "GOOGLE_STREET_VIEW_PHOTOGRAPHER",
        lead_temperature: "HOT",
        user_type: "GOOGLE_STREET_VIEW_PHOTOGRAPHER",
        conversation_stage: "PRODUCT_INTRODUCTION",
        should_reply: true,
        human_review_required: false,
        reason: "User interested in Google Street View publishing.",
        response: "Yes, PanoPublish has direct Google Street View integration. You upload your equirectangular panoramas, link the scenes, and can publish straight to Google Maps. What camera are you shooting with?",
        suggested_action: "INTRODUCE_STREET_VIEW"
      };
    }

    if (text.includes("insta360") || text.includes("x3") || text.includes("x4") || text.includes("ricoh")) {
      return {
        intent: "360_PHOTOGRAPHER",
        lead_temperature: "WARM",
        user_type: "360_PHOTOGRAPHER",
        conversation_stage: "DISCOVERY",
        should_reply: true,
        human_review_required: false,
        reason: "User specified camera model.",
        response: "An Insta360 or Ricoh Theta is plenty to get started. The standard workflow is uploading your 360° panoramas, connecting the hotspots into a tour, and embedding it for your client. Are you building tours for real estate or local businesses?",
        suggested_action: "DISCOVER_USE_CASE"
      };
    }

    if (text.includes("matterport") || text.includes("cloudpano")) {
      return {
        intent: "TOOL_COMPARISON",
        lead_temperature: "WARM",
        user_type: "TOOL_EVALUATOR",
        conversation_stage: "PRODUCT_INTRODUCTION",
        should_reply: true,
        human_review_required: false,
        reason: "User comparing with market alternatives.",
        response: "Many creators switch to PanoPublish because there's no forced hardware lock-in or steep recurring costs, plus we offer Pay-As-You-Go credits that never expire. What features do you rely on most in your current workflow?",
        suggested_action: "COMPARE_WORKFLOW"
      };
    }

    return {
      intent: "PRODUCT_INTEREST",
      lead_temperature: "WARM",
      user_type: "VIRTUAL_TOUR_CREATOR",
      conversation_stage: "DISCOVERY",
      should_reply: true,
      human_review_required: false,
      reason: "General inquiry about virtual tour publishing.",
      response: "Hey! PanoPublish makes it easy to organize 360° scenes, connect hotspots, and publish or embed client tours with custom branding. Are you working on a specific virtual tour project right now?",
      suggested_action: "DISCOVER_PROJECT"
    };
  }

  /**
   * Main evaluation pipeline.
   */
  async evaluateDm(params) {
    const { incomingMessage, username } = params;

    // 1. Fast sensitive escalation check
    const escalation = this.checkSensitiveEscalation(incomingMessage);
    if (escalation.requiresEscalation) {
      logger.warn(`[AI Engine] Escalating @${username} to HUMAN_REVIEW_REQUIRED: ${escalation.reason}`);
      return {
        intent: "HUMAN_REVIEW_REQUIRED",
        lead_temperature: "HOT",
        user_type: "SENSITIVE_CUSTOMER",
        conversation_stage: "CLOSED",
        should_reply: false,
        human_review_required: true,
        reason: escalation.reason,
        response: null,
        suggested_action: "ESCALATE_HUMAN"
      };
    }

    // 2. Try LLM Call (if API key is present)
    if (process.env.AI_API_KEY && process.env.AI_API_KEY !== "your_openai_or_compatible_api_key_here") {
      try {
        const prompt = this.buildEvaluationPrompt(params);
        logger.ai(`Evaluating DM from @${username} via ${process.env.AI_MODEL || "LLM"}...`);
        const result = await aiRuntime.generateCompletion(prompt);
        return this.validateAndNormalizeResponse(result);
      } catch (err) {
        logger.warn(`[AI Engine] LLM invocation failed (${err.message}). Falling back to contextual heuristic simulation.`);
      }
    }

    // 3. Fallback to simulation mode
    return this.generateSimulatedResponse(incomingMessage, username);
  }
}

const aiDecisionEngine = new AiDecisionEngine();
module.exports = aiDecisionEngine;
