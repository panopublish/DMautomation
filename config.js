/**
 * config.js
 * Centralized configuration loader for PanoPublish DM Automation.
 * Parses .env file natively without requiring external dependencies.
 */

const fs = require("fs");
const path = require("path");

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  try {
    const content = fs.readFileSync(envPath, "utf8");
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const equalsIdx = trimmed.indexOf("=");
      if (equalsIdx === -1) continue;
      const key = trimmed.slice(0, equalsIdx).trim();
      let val = trimmed.slice(equalsIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch (err) {
    console.warn(`[CONFIG] Could not read .env: ${err.message}`);
  }
}

// Automatically load .env from root
const rootDir = __dirname;
loadEnvFile(path.join(rootDir, ".env"));

const CONFIG = {
  ROOT_DIR: rootDir,
  DATA_DIR: path.resolve(rootDir, process.env.DATA_DIR || "./data"),
  LOGS_DIR: path.resolve(rootDir, process.env.LOGS_DIR || "./logs"),
  KNOWLEDGE_DIR: path.resolve(rootDir, process.env.KNOWLEDGE_DIR || "./knowledge"),

  // Browser CDP
  BRAVE_CDP_URL: process.env.BRAVE_CDP_URL || "http://127.0.0.1:9222",
  INSTAGRAM_HOME_URL: process.env.INSTAGRAM_HOME_URL || "https://www.instagram.com/",
  INSTAGRAM_MESSAGES_URL: process.env.INSTAGRAM_MESSAGES_URL || "https://www.instagram.com/direct/inbox/",
  DEFAULT_ACCOUNT_ID: process.env.DEFAULT_ACCOUNT_ID || "instagram-account-1",

  // AI Configuration
  AI_PROVIDER: process.env.AI_PROVIDER || "openai",
  AI_API_KEY: process.env.AI_API_KEY || "",
  AI_BASE_URL: (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
  AI_MODEL: process.env.AI_MODEL || "gpt-4o-mini",
  AI_TEMPERATURE: Number(process.env.AI_TEMPERATURE) || 0.3,
  AI_MAX_TOKENS: Number(process.env.AI_MAX_TOKENS) || 1024,
  AI_TIMEOUT_MS: Number(process.env.AI_TIMEOUT_MS) || 60000,

  // Safety & Mode Controls
  DRY_RUN: process.env.DRY_RUN !== "false", // Default true
  APPROVAL_MODE: process.env.APPROVAL_MODE !== "false", // Default true
  POSTING_ENABLED: process.env.POSTING_ENABLED === "true", // Default false

  // Rate Limiting
  MAX_DM_REPLIES_PER_HOUR: Number(process.env.MAX_DM_REPLIES_PER_HOUR) || 10,
  MAX_DM_REPLIES_PER_DAY: Number(process.env.MAX_DM_REPLIES_PER_DAY) || 30,
  MIN_ACTION_DELAY_MS: Number(process.env.MIN_ACTION_DELAY_MS) || 15000,
  MAX_ACTION_DELAY_MS: Number(process.env.MAX_ACTION_DELAY_MS) || 45000,

  // Product Links
  PANO_PUBLISH_WEBSITE: process.env.PANO_PUBLISH_WEBSITE || "https://panopublish.com",
  PANO_PUBLISH_SIGNUP: process.env.PANO_PUBLISH_SIGNUP || "https://panopublish.com/signup",
  PANO_PUBLISH_TUTORIAL: process.env.PANO_PUBLISH_TUTORIAL || "https://panopublish.com/tutorials"
};

// Ensure basic directories exist
for (const dir of [CONFIG.DATA_DIR, CONFIG.LOGS_DIR, CONFIG.KNOWLEDGE_DIR]) {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {}
  }
}

module.exports = CONFIG;
