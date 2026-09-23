/**
 * src/telemetry/action-telemetry.js
 * Tracks lifecycle events, execution metrics, and verification states for DM actions.
 */

const fs = require("fs");
const path = require("path");
const CONFIG = require("../../config");
const logger = require("../logging/logger");

class ActionTelemetry {
  constructor() {
    this.events = [];
    this.telemetryFile = path.join(CONFIG.LOGS_DIR, "telemetry.jsonl");
  }

  record(event) {
    const enriched = {
      timestamp: new Date().toISOString(),
      ...event
    };
    this.events.push(enriched);
    try {
      fs.appendFileSync(this.telemetryFile, JSON.stringify(enriched) + "\n", "utf8");
    } catch (e) {}
    logger.action(enriched.type || "TELEMETRY_EVENT", enriched.targetId || "global", enriched);
    return enriched;
  }

  async captureEvidence(page, context = {}) {
    if (!page || (typeof page.isClosed === "function" && page.isClosed())) {
      return { url: null, timestamp: new Date().toISOString(), error: "Page is not available" };
    }
    try {
      const url = page.url();
      const title = await page.title().catch(() => "");
      const screenshotDir = path.join(CONFIG.LOGS_DIR, "screenshots");
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      const filename = `evidence_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.png`;
      const fullPath = path.join(screenshotDir, filename);
      await page.screenshot({ path: fullPath, fullPage: false }).catch(() => {});
      return {
        url,
        title,
        screenshotPath: fullPath,
        timestamp: new Date().toISOString(),
        ...context
      };
    } catch (err) {
      return { error: err.message, timestamp: new Date().toISOString(), ...context };
    }
  }
}

const telemetry = new ActionTelemetry();
module.exports = telemetry;
