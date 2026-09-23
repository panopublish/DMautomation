/**
 * src/logging/logger.js
 * Structured logging module for PanoPublish DM Automation.
 * Writes to console and dedicated log files (app.log, dm.log, ai.log, actions.log, errors.log).
 */

const fs = require("fs");
const path = require("path");
const CONFIG = require("../../config");

class Logger {
  constructor() {
    this.logsDir = CONFIG.LOGS_DIR;
    this.ensureLogsDir();
  }

  ensureLogsDir() {
    if (!fs.existsSync(this.logsDir)) {
      try {
        fs.mkdirSync(this.logsDir, { recursive: true });
      } catch (e) {}
    }
  }

  formatTimestamp() {
    return new Date().toISOString();
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = this.formatTimestamp();
    const metaString = Object.keys(meta).length > 0 ? " " + JSON.stringify(meta) : "";
    return `[${timestamp}] [${level}] ${message}${metaString}`;
  }

  appendToFile(filename, line) {
    try {
      this.ensureLogsDir();
      fs.appendFileSync(path.join(this.logsDir, filename), line + "\n", "utf8");
    } catch (e) {
      // Fallback silently if disk is temporarily busy
    }
  }

  info(message, meta = {}) {
    const line = this.formatMessage("INFO", message, meta);
    console.log(`\x1b[36m${line}\x1b[0m`);
    this.appendToFile("app.log", line);
  }

  warn(message, meta = {}) {
    const line = this.formatMessage("WARN", message, meta);
    console.warn(`\x1b[33m${line}\x1b[0m`);
    this.appendToFile("app.log", line);
  }

  error(message, error = null, meta = {}) {
    const errMeta = error ? { ...meta, error: error.message || String(error), stack: error.stack } : meta;
    const line = this.formatMessage("ERROR", message, errMeta);
    console.error(`\x1b[31m${line}\x1b[0m`);
    this.appendToFile("app.log", line);
    this.appendToFile("errors.log", line);
  }

  dm(message, meta = {}) {
    const line = this.formatMessage("DM", message, meta);
    console.log(`\x1b[35m${line}\x1b[0m`);
    this.appendToFile("app.log", line);
    this.appendToFile("dm.log", line);
  }

  ai(message, meta = {}) {
    const line = this.formatMessage("AI", message, meta);
    console.log(`\x1b[34m${line}\x1b[0m`);
    this.appendToFile("app.log", line);
    this.appendToFile("ai.log", line);
  }

  action(actionName, targetId, meta = {}) {
    const line = this.formatMessage("ACTION", `[${actionName}] target=${targetId}`, meta);
    console.log(`\x1b[32m${line}\x1b[0m`);
    this.appendToFile("app.log", line);
    this.appendToFile("actions.log", line);
  }
}

const logger = new Logger();
module.exports = logger;
