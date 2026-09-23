/**
 * src/safety/rate-limiter.js
 * Conservative rate limiting and human delay pacing for Instagram DM operations.
 */

const CONFIG = require("../../config");
const stateStore = require("../storage/state-store");
const logger = require("../logging/logger");

class RateLimiter {
  constructor() {
    this.maxPerHour = CONFIG.MAX_DM_REPLIES_PER_HOUR;
    this.maxPerDay = CONFIG.MAX_DM_REPLIES_PER_DAY;
  }

  canPerformDmReply() {
    const oneHourActions = stateStore.getActionsInWindow(3600 * 1000);
    const hourlyDmCount = oneHourActions.filter(a => a.actionType === "DM_REPLY_SENT").length;

    if (hourlyDmCount >= this.maxPerHour) {
      return {
        allowed: false,
        reason: `Exceeded maximum DM replies per hour (${hourlyDmCount}/${this.maxPerHour}). Cooldown required.`
      };
    }

    const oneDayActions = stateStore.getActionsInWindow(24 * 3600 * 1000);
    const dailyDmCount = oneDayActions.filter(a => a.actionType === "DM_REPLY_SENT").length;

    if (dailyDmCount >= this.maxPerDay) {
      return {
        allowed: false,
        reason: `Exceeded maximum DM replies per day (${dailyDmCount}/${this.maxPerDay}). Cooldown required.`
      };
    }

    return {
      allowed: true,
      hourlyCount: hourlyDmCount,
      dailyCount: dailyDmCount
    };
  }

  recordDmReply(targetId, meta = {}) {
    stateStore.recordAction("DM_REPLY_SENT", targetId, meta);
  }

  getRandomDelayMs() {
    const min = CONFIG.MIN_ACTION_DELAY_MS || 15000;
    const max = CONFIG.MAX_ACTION_DELAY_MS || 45000;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  async sleepHumanDelay() {
    const delay = this.getRandomDelayMs();
    logger.info(`Pacing action with human delay: ${(delay / 1000).toFixed(1)}s`);
    await new Promise(res => setTimeout(res, delay));
    return delay;
  }
}

const rateLimiter = new RateLimiter();
module.exports = rateLimiter;
