/**
 * src/browser/accounts-manager.js
 * Account-aware registry and session router.
 * Enables future multi-account scaling across multiple PanoPublish Instagram handles
 * while avoiding credential duplication.
 */

const fs = require("fs");
const path = require("path");
const CONFIG = require("../../config");
const logger = require("../logging/logger");

class AccountsManager {
  constructor() {
    this.accountsDir = path.join(CONFIG.DATA_DIR, "accounts");
    this.ensureAccountsDir();
  }

  ensureAccountsDir() {
    if (!fs.existsSync(this.accountsDir)) {
      try {
        fs.mkdirSync(this.accountsDir, { recursive: true });
      } catch (e) {}
    }
  }

  getAccountConfig(accountId = CONFIG.DEFAULT_ACCOUNT_ID) {
    const accountFolder = path.join(this.accountsDir, accountId);
    if (!fs.existsSync(accountFolder)) {
      try {
        fs.mkdirSync(accountFolder, { recursive: true });
        const defaultProfile = {
          accountId,
          platform: "instagram",
          configuredAt: new Date().toISOString(),
          notes: "Mapped to active Brave profile session"
        };
        fs.writeFileSync(path.join(accountFolder, "profile.json"), JSON.stringify(defaultProfile, null, 2), "utf8");
      } catch (e) {}
    }

    const profileFile = path.join(accountFolder, "profile.json");
    if (fs.existsSync(profileFile)) {
      try {
        return JSON.parse(fs.readFileSync(profileFile, "utf8"));
      } catch (e) {}
    }

    return { accountId, platform: "instagram" };
  }

  listAccounts() {
    this.ensureAccountsDir();
    try {
      const dirs = fs.readdirSync(this.accountsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
      return dirs.length > 0 ? dirs : [CONFIG.DEFAULT_ACCOUNT_ID];
    } catch (e) {
      return [CONFIG.DEFAULT_ACCOUNT_ID];
    }
  }
}

const accountsManager = new AccountsManager();
module.exports = accountsManager;
