#!/usr/bin/env node
/**
 * cli/panopublish-cli.js
 * Primary Unified CLI for PanoPublish Instagram DM Automation.
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const CONFIG = require("../config");
const braveBrowserManager = require("../src/browser/brave-browser-manager");
const { checkInstagramAuth } = require("../src/instagram/instagram-auth");
const instagramScanner = require("../src/instagram/instagram-scanner");
const messageClassifier = require("../src/instagram/message-classifier");
const aiDecisionEngine = require("../src/ai/ai-decision-engine");
const duplicateGuard = require("../src/safety/duplicate-guard");
const approvalManager = require("../src/approval/approval-manager");
const instagramSender = require("../src/instagram/instagram-sender");
const stateStore = require("../src/storage/state-store");
const logger = require("../src/logging/logger");

async function commandSetup() {
  console.log("\n==============================================");
  console.log("       PANOPUBLISH DM AUTOMATION SETUP");
  console.log("==============================================");

  const envFile = path.join(CONFIG.ROOT_DIR, ".env");
  const envExample = path.join(CONFIG.ROOT_DIR, ".env.example");

  if (!fs.existsSync(envFile) && fs.existsSync(envExample)) {
    fs.copyFileSync(envExample, envFile);
    console.log("✓ Created .env from .env.example");
  } else if (fs.existsSync(envFile)) {
    console.log("✓ .env already exists.");
  }

  // Ensure directories
  for (const dir of [CONFIG.DATA_DIR, CONFIG.LOGS_DIR, CONFIG.KNOWLEDGE_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✓ Created directory: ${path.relative(CONFIG.ROOT_DIR, dir)}/`);
    }
  }

  console.log("\nSetup completed successfully.");
  console.log("Next steps:");
  console.log("1. Open Brave with: brave.exe --remote-debugging-port=9222");
  console.log("2. Verify connection: npm run auth");
  console.log("3. Test with: npm run dry-run");
  console.log("==============================================\n");
  return 0;
}

async function commandAuth() {
  const result = await checkInstagramAuth({ printResult: true });
  braveBrowserManager.disconnect();
  return result.isAuthenticated ? 0 : 1;
}

async function commandStatus() {
  console.log("\n==============================================");
  console.log("       PANOPUBLISH AUTOMATION STATUS");
  console.log("==============================================");

  const isCdpOpen = await braveBrowserManager.isCdpReachable();
  let authStatus = "DISCONNECTED";
  let activeHandle = null;

  if (isCdpOpen) {
    const auth = await checkInstagramAuth({ printResult: false });
    authStatus = auth.isAuthenticated ? "AUTHENTICATED" : "NOT AUTHENTICATED";
    activeHandle = auth.detectedHandle;
  }

  const pendingList = stateStore.getPendingApprovals();
  const convCount = Object.keys(stateStore.state.conversations).length;
  const recentDms = stateStore.getActionsInWindow(3600 * 1000);
  const repliesSentCount = stateStore.state.stats.total_replies_sent || 0;
  const humanReviewCount = stateStore.state.stats.total_human_review_required || 0;

  console.log(`Brave CDP                 : ${isCdpOpen ? "CONNECTED (" + CONFIG.BRAVE_CDP_URL + ")" : "DISCONNECTED"}`);
  console.log(`Instagram                 : ${isCdpOpen ? "CONNECTED" : "DISCONNECTED"}`);
  console.log(`Instagram authentication  : ${authStatus}${activeHandle ? " (@" + activeHandle + ")" : ""}`);
  console.log(`DM conversations tracked  : ${convCount}`);
  console.log(`Incoming messages seen    : ${stateStore.state.stats.total_incoming_messages}`);
  console.log(`AI analyzed               : ${stateStore.state.stats.total_ai_analyzed}`);
  console.log(`Pending approval          : ${pendingList.length}`);
  console.log(`Replies sent (verified)   : ${repliesSentCount}`);
  console.log(`Human review required     : ${humanReviewCount}`);
  console.log(`Operating Mode            : ${CONFIG.DRY_RUN ? "DRY_RUN (Simulation)" : "LIVE"}`);
  console.log(`Approval Mode             : ${CONFIG.APPROVAL_MODE ? "ENABLED (Human in the loop)" : "AUTOMATIC"}`);
  console.log(`Posting Allowed           : ${CONFIG.POSTING_ENABLED ? "TRUE" : "FALSE"}`);
  console.log("==============================================\n");

  braveBrowserManager.disconnect();
  return 0;
}

async function commandScan() {
  console.log("\n==============================================");
  console.log("         INSTAGRAM INBOX SCAN");
  console.log("==============================================");

  try {
    const conversations = await instagramScanner.scanInbox();
    console.log(`\nScan Summary:`);
    console.log(`  Found Conversations : ${conversations.length}`);
    for (const c of conversations) {
      console.log(`  - @${c.username} (${c.threadId}): "${c.lastMessage.slice(0, 50)}"`);
      // Update state store
      stateStore.saveConversation({
        username: c.username,
        threadId: c.threadId,
        lastIncomingText: c.lastMessage
      });
    }
    console.log("==============================================\n");
    return 0;
  } catch (err) {
    console.error("❌ Scan failed:", err.message);
    return 1;
  } finally {
    braveBrowserManager.disconnect();
  }
}

async function commandAnalyze(options = {}) {
  console.log("\n==============================================");
  console.log("      AI CONVERSATION & INTENT ANALYSIS");
  console.log("==============================================");

  const conversations = await instagramScanner.scanInbox();
  let hotCount = 0;
  let warmCount = 0;
  let humanReviewCount = 0;
  let newPendingCount = 0;

  for (const conv of conversations) {
    const cleanLast = conv.lastMessage;
    const convId = conv.threadId || conv.username;

    // 1. Check incoming vs outgoing classification
    const classification = messageClassifier.classifyMessage({
      text: cleanLast,
      isDomOutgoing: conv.isDomOutgoing,
      senderName: conv.username,
      convId,
      account: CONFIG.DEFAULT_ACCOUNT_ID
    });

    if (classification.direction === "OUTGOING") {
      logger.info(`Skipping @${conv.username}: Last message was sent by us. Awaiting user response.`);
      continue;
    }

    if (classification.direction === "UNCERTAIN") {
      logger.warn(`Skipping @${conv.username}: Direction uncertain. Marked for human review.`);
      stateStore.state.stats.total_human_review_required++;
      stateStore.saveState();
      continue;
    }

    // 2. Generate deterministic turn ID
    const turnId = duplicateGuard.generateTurnId(
      CONFIG.DEFAULT_ACCOUNT_ID,
      convId,
      conv.username,
      cleanLast
    );

    // Skip if turn already handled
    if (duplicateGuard.hasTurnBeenHandled(turnId)) {
      continue;
    }

    // Load existing memory
    const existingMemory = stateStore.getConversation(convId) || {};

    // 3. AI Evaluation
    const decision = await aiDecisionEngine.evaluateDm({
      username: conv.username,
      incomingMessage: cleanLast,
      conversationHistory: existingMemory.incomingMessages || [],
      conversationStage: existingMemory.conversationStage || "DISCOVERY",
      productIntroduced: existingMemory.panopublishIntroduced,
      pricingDiscussed: existingMemory.pricingDiscussed
    });

    stateStore.state.stats.total_ai_analyzed++;

    if (decision.lead_temperature === "HOT") hotCount++;
    if (decision.lead_temperature === "WARM") warmCount++;

    if (decision.human_review_required) {
      humanReviewCount++;
      stateStore.state.stats.total_human_review_required++;
    }

    // Update conversation state
    stateStore.saveConversation({
      username: conv.username,
      threadId: conv.threadId,
      detectedIntent: decision.intent,
      leadTemperature: decision.lead_temperature,
      userType: decision.user_type,
      conversationStage: decision.conversation_stage,
      lastAiResponse: decision.response,
      lastIncomingText: cleanLast
    });

    // 4. Queue for Approval or Simulation
    if (decision.should_reply && decision.response) {
      if (CONFIG.APPROVAL_MODE) {
        stateStore.addPendingApproval(turnId, {
          username: conv.username,
          threadId: conv.threadId,
          incomingText: cleanLast,
          proposedReply: decision.response,
          intent: decision.intent,
          leadTemperature: decision.lead_temperature,
          reason: decision.reason
        });
        newPendingCount++;
      } else if (CONFIG.DRY_RUN || !CONFIG.POSTING_ENABLED) {
        logger.info(`[DRY RUN] Generated simulated response for @${conv.username}`);
        stateStore.recordOutgoingMessage(conv.username, decision.response, "SIMULATED");
        stateStore.recordHandledTurn(turnId, {
          username: conv.username,
          responseText: decision.response,
          status: "SIMULATED"
        });
      }
    }
  }

  console.log("\nAnalysis Summary:");
  console.log(`  HOT Qualified Leads     : ${hotCount}`);
  console.log(`  WARM Qualified Leads    : ${warmCount}`);
  console.log(`  Human Review Triggered  : ${humanReviewCount}`);
  console.log(`  New Pending Approvals   : ${newPendingCount}`);
  console.log(`  Total Pending Queue     : ${stateStore.getPendingApprovals().length}`);
  console.log("==============================================\n");

  braveBrowserManager.disconnect();
  return 0;
}

async function commandApprove() {
  console.log("\n==============================================");
  console.log("          HUMAN APPROVAL INTERFACE");
  console.log("==============================================");

  const pending = stateStore.getPendingApprovals();
  if (pending.length === 0) {
    console.log("✓ No pending DM replies awaiting review.\n");
    return 0;
  }

  console.log(`Found ${pending.length} pending replies for review.\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise(res => rl.question(prompt, res));

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i];
    console.log("----------------------------------------------");
    console.log(`[${i + 1}/${pending.length}] TARGET: @${item.username}`);
    console.log(`Incoming Message:`);
    console.log(`  "${item.incomingText}"\n`);
    console.log(`AI Classification:`);
    console.log(`  Intent      : ${item.intent}`);
    console.log(`  Temperature : ${item.leadTemperature}`);
    console.log(`  Reason      : ${item.reason}`);
    console.log(`Suggested Reply:`);
    console.log(`  \x1b[32m"${item.proposedReply}"\x1b[0m\n`);

    const action = (await question("Action: [A]pprove | [R]eject | [E]dit | [S]kip | [Q]uit > ")).trim().toUpperCase();

    if (action === "A") {
      console.log("✓ Approved!");
      const res = await approvalManager.approveItem(item.dmTurnId);
      if (res.sendResult?.verified) {
        console.log("✓ Message sent and verified in browser DOM!");
      } else if (res.sendResult?.dryRun) {
        console.log("✓ [DRY RUN] Marked as simulated approved.");
      } else {
        console.log(`Result: ${JSON.stringify(res.sendResult)}`);
      }
    } else if (action === "E") {
      const edited = await question("Enter custom reply text > ");
      if (edited.trim()) {
        console.log("✓ Approved with custom text!");
        await approvalManager.approveItem(item.dmTurnId, edited.trim());
      } else {
        console.log("Edit cancelled.");
      }
    } else if (action === "R") {
      console.log("❌ Rejected.");
      approvalManager.rejectItem(item.dmTurnId);
    } else if (action === "Q") {
      break;
    } else {
      console.log("⏭ Skipped for now.");
    }
    console.log("");
  }

  rl.close();
  braveBrowserManager.disconnect();
  return 0;
}

async function commandDryRun() {
  console.log("\n==============================================");
  console.log("          PANOPUBLISH DRY RUN MODE");
  console.log("==============================================");
  console.log("Executing full cycle in simulation (zero browser sends)...");

  await commandAnalyze();
  await commandStatus();
  return 0;
}

// Router
async function main() {
  const cmd = (process.argv[2] || "status").toLowerCase();

  switch (cmd) {
    case "setup":
      return commandSetup();
    case "auth":
      return commandAuth();
    case "status":
      return commandStatus();
    case "scan":
    case "dms":
      return commandScan();
    case "analyze":
      return commandAnalyze();
    case "approve":
      return commandApprove();
    case "dry-run":
      return commandDryRun();
    case "start":
      console.log("Starting single-pass automated cycle...");
      await commandAnalyze();
      return commandStatus();
    default:
      console.log(`Unknown command: ${cmd}`);
      console.log("Usage: node cli/panopublish-cli.js [setup|auth|status|scan|dms|analyze|approve|dry-run|start]");
      return 1;
  }
}

if (require.main === module) {
  main()
    .then(code => process.exit(code || 0))
    .catch(err => {
      console.error("Fatal error:", err);
      process.exit(1);
    });
}

module.exports = {
  commandSetup,
  commandAuth,
  commandStatus,
  commandScan,
  commandAnalyze,
  commandApprove,
  commandDryRun
};
