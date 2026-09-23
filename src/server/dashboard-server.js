/**
 * src/server/dashboard-server.js
 * High-performance native HTTP server for PanoPublish Analytics & Management Dashboard.
 * Serves static web frontend and provides REST APIs for live metrics and approval actions.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const CONFIG = require("../../config");
const stateStore = require("../storage/state-store");
const braveBrowserManager = require("../browser/brave-browser-manager");
const { checkInstagramAuth } = require("../instagram/instagram-auth");
const approvalManager = require("../approval/approval-manager");
const leadDiscoveryEngine = require("../discovery/lead-discovery-engine");
const logger = require("../logging/logger");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.resolve(__dirname, "../../public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // CORS pre-flight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    return res.end();
  }

  // --- API ROUTES ---

  // 1. GET /api/stats
  if (method === "GET" && pathname === "/api/stats") {
    const isCdpOpen = await braveBrowserManager.isCdpReachable();
    const sent = stateStore.state.stats.total_replies_sent || 0;
    const incoming = stateStore.state.stats.total_incoming_messages || 0;
    const replyRate = sent > 0 ? Math.min(100, Math.round((incoming / sent) * 100)) : 0;
    const pending = stateStore.getPendingApprovals().length;
    const convCount = Object.keys(stateStore.state.conversations).length;
    const leads = leadDiscoveryEngine.getLeads().length;

    return sendJson(res, 200, {
      dmsSent: sent,
      repliesReceived: incoming,
      replyRatePercent: replyRate,
      conversationsTracked: convCount,
      pendingApprovals: pending,
      indianLeadsDiscovered: leads,
      humanReviewRequired: stateStore.state.stats.total_human_review_required || 0,
      braveCdpConnected: isCdpOpen,
      cdpUrl: CONFIG.BRAVE_CDP_URL,
      operatingMode: CONFIG.DRY_RUN ? "DRY_RUN" : "LIVE",
      approvalMode: CONFIG.APPROVAL_MODE,
      postingEnabled: CONFIG.POSTING_ENABLED
    });
  }

  // 2. GET /api/conversations
  if (method === "GET" && pathname === "/api/conversations") {
    const convs = Object.values(stateStore.state.conversations).map(c => ({
      username: c.username,
      threadId: c.threadId,
      detectedIntent: c.detectedIntent || "DISCOVERY",
      leadTemperature: c.leadTemperature || "WARM",
      conversationStage: c.conversationStage || "DISCOVERY",
      lastIncomingText: c.lastIncomingText || "",
      lastOutgoingText: c.lastOutgoingText || "",
      incomingCount: (c.incomingMessages || []).length,
      outgoingCount: (c.outgoingMessages || []).length,
      lastActiveAt: c.timestamps?.lastActiveAt || new Date().toISOString()
    }));
    return sendJson(res, 200, { conversations: convs });
  }

  // 3. GET /api/approvals
  if (method === "GET" && pathname === "/api/approvals") {
    const approvals = stateStore.getPendingApprovals();
    return sendJson(res, 200, { approvals });
  }

  // 4. POST /api/approvals/action
  if (method === "POST" && pathname === "/api/approvals/action") {
    const body = await parseJsonBody(req);
    const { dmTurnId, action, editedText } = body;

    if (!dmTurnId) {
      return sendJson(res, 400, { error: "Missing dmTurnId" });
    }

    if (action === "approve") {
      const result = await approvalManager.approveItem(dmTurnId, editedText);
      if (!result.success) {
        return sendJson(res, 200, { success: false, error: result.reason || "DM sending failed", result });
      }
      return sendJson(res, 200, { success: true, result });
    } else if (action === "reject") {
      const result = approvalManager.rejectItem(dmTurnId);
      return sendJson(res, 200, { success: true, result });
    }

    return sendJson(res, 400, { error: "Invalid action. Use approve or reject." });
  }

  // 5. GET /api/leads
  if (method === "GET" && pathname === "/api/leads") {
    const leads = leadDiscoveryEngine.getLeads();
    return sendJson(res, 200, { leads });
  }

  // 6. POST /api/discovery/trigger
  if (method === "POST" && pathname === "/api/discovery/trigger") {
    const body = await parseJsonBody(req);
    const leads = await leadDiscoveryEngine.runDiscovery(body);
    return sendJson(res, 200, { success: true, count: leads.length, leads });
  }

  // 7a. GET /api/outreach-hub — list all curated outreach targets
  if (method === "GET" && pathname === "/api/outreach-hub") {
    const hubFile = path.resolve(__dirname, "../../data/outreach-hub.json");
    try {
      const data = JSON.parse(fs.readFileSync(hubFile, "utf8"));
      return sendJson(res, 200, { creators: data, count: data.length });
    } catch (e) {
      return sendJson(res, 200, { creators: [], count: 0 });
    }
  }

  // 7b. POST /api/outreach-hub/add — add or update a creator in hub
  if (method === "POST" && pathname === "/api/outreach-hub/add") {
    const body = await parseJsonBody(req);
    const hubFile = path.resolve(__dirname, "../../data/outreach-hub.json");
    try {
      const existing = JSON.parse(fs.readFileSync(hubFile, "utf8"));
      const idx = existing.findIndex(c => c.username === body.username);
      const now = new Date().toISOString();
      if (idx !== -1) {
        existing[idx] = { ...existing[idx], ...body, updatedAt: now };
      } else {
        existing.push({ id: `hub_${Date.now()}`, discoveredAt: now, status: "ACTIVE", score: 80, ...body });
      }
      fs.writeFileSync(hubFile, JSON.stringify(existing, null, 2), "utf8");
      return sendJson(res, 200, { success: true, count: existing.length });
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }

  // 7c. POST /api/outreach-hub/send — mark creator messaged (Automated CDP disabled for safety)
  if (method === "POST" && pathname === "/api/outreach-hub/send") {
    const body = await parseJsonBody(req);
    const { username, id, message } = body;
    try {
      // Update status in hub
      const hubFile = path.resolve(__dirname, "../../data/outreach-hub.json");
      try {
        const data = JSON.parse(fs.readFileSync(hubFile, "utf8"));
        const idx = data.findIndex(c => (id && c.id === id) || (username && c.username === username));
        if (idx !== -1) {
          data[idx].status = "MESSAGED";
          data[idx].lastContactedAt = new Date().toISOString();
          if (message) data[idx].lastMessageSent = message;
          fs.writeFileSync(hubFile, JSON.stringify(data, null, 2), "utf8");
        }
      } catch (e) {}

      return sendJson(res, 200, { success: true, manual: true, username });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 7d. POST /api/outreach-hub/status — update status of a creator
  if (method === "POST" && pathname === "/api/outreach-hub/status") {
    const body = await parseJsonBody(req);
    const { id, username, status } = body;
    const hubFile = path.resolve(__dirname, "../../data/outreach-hub.json");
    try {
      const data = JSON.parse(fs.readFileSync(hubFile, "utf8"));
      const idx = data.findIndex(c => (id && c.id === id) || (username && c.username === username));
      if (idx !== -1) {
        data[idx].status = status;
        data[idx].updatedAt = new Date().toISOString();
        fs.writeFileSync(hubFile, JSON.stringify(data, null, 2), "utf8");
      }
      return sendJson(res, 200, { success: true });
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }

  // 7. GET /api/status
  if (method === "GET" && pathname === "/api/status") {
    const isCdpOpen = await braveBrowserManager.isCdpReachable();
    let auth = { isAuthenticated: false };
    if (isCdpOpen) {
      auth = await checkInstagramAuth({ printResult: false });
    }
    return sendJson(res, 200, {
      cdpConnected: isCdpOpen,
      authenticated: auth.isAuthenticated,
      handle: auth.detectedHandle,
      url: auth.url
    });
  }

  // --- STATIC FILE SERVING ---
  let filePath = path.join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);
  const ext = path.extname(filePath).toLowerCase();

  // Security: prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, "index.html");
    }

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        return res.end("Error loading asset");
      }
      const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || "text/plain";
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    });
  });
});

const os = require("os");

function getNetworkIps() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal && !net.address.startsWith("192.168.56.")) {
        ips.push({ name, address: net.address });
      }
    }
  }
  return ips;
}

function startServer() {
  server.listen(PORT, "0.0.0.0", () => {
    const netIps = getNetworkIps();
    console.log("\n============================================================");
    console.log("       PANOPUBLISH DM AUTOMATION & ANALYTICS DASHBOARD");
    console.log("============================================================");
    console.log(`✓ Local Access   : http://localhost:${PORT}`);
    if (netIps.length > 0) {
      netIps.forEach(ip => {
        console.log(`📱 Mobile (Wi-Fi): http://${ip.address}:${PORT}  (${ip.name})`);
      });
    }
    console.log(`✓ API Endpoint   : http://localhost:${PORT}/api/stats`);
    console.log(`✓ Brave CDP      : ${CONFIG.BRAVE_CDP_URL}`);
    console.log("------------------------------------------------------------");
    console.log("💡 Mobile Access:");
    if (netIps.length > 0) {
      console.log(`   • Same Wi-Fi : http://${netIps[0].address}:${PORT}`);
    }
    console.log("   • Anywhere   : Run 'npm run mobile' or 'npx localtunnel --port 3000'");
    console.log("============================================================\n");
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  server,
  startServer
};
