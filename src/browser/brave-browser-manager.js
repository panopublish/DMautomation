/**
 * src/browser/brave-browser-manager.js
 * Puppeteer-core CDP connection manager for the existing authenticated Brave browser session.
 * Connects to http://127.0.0.1:9222 (configurable via BRAVE_CDP_URL),
 * reuses open Instagram tabs, and preserves user logins and cookies.
 */

const http = require("http");
const CONFIG = require("../../config");
const logger = require("../logging/logger");

let _puppeteer = null;
async function getPuppeteer() {
  if (!_puppeteer) {
    const mod = await import("puppeteer-core");
    _puppeteer = mod.default || mod;
  }
  return _puppeteer;
}

class BraveBrowserManager {
  constructor() {
    this.browser = null;
    this.cdpUrl = CONFIG.BRAVE_CDP_URL;
    this._instagramPage = null;
    this._pageMutex = Promise.resolve();
  }

  isPageAlive(page) {
    if (!page || page.isClosed()) return false;
    try {
      const frame = page.mainFrame();
      return Boolean(frame && !frame.isDetached());
    } catch (e) {
      return false;
    }
  }

  /**
   * Fast check whether Brave CDP port is open and responding.
   */
  async isCdpReachable(timeoutMs = 1500) {
    return new Promise(resolve => {
      try {
        const u = new URL(this.cdpUrl);
        const req = http.get(
          {
            hostname: u.hostname,
            port: u.port,
            path: "/json/version",
            timeout: timeoutMs
          },
          res => {
            resolve(res.statusCode === 200);
          }
        );
        req.on("error", () => resolve(false));
        req.on("timeout", () => {
          req.destroy();
          resolve(false);
        });
      } catch (e) {
        resolve(false);
      }
    });
  }

  /**
   * Connects to already running Brave Browser via CDP with retries.
   */
  async connect(retries = 3, delayMs = 2000) {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    const reachable = await this.isCdpReachable();
    if (!reachable) {
      throw new Error(
        `Brave CDP is not reachable at ${this.cdpUrl}.\n` +
        `Ensure Brave is running with remote debugging enabled:\n` +
        `  brave.exe --remote-debugging-port=9222\n` +
        `The automation will attach directly to your existing logged-in session without asking for credentials.`
      );
    }

    const puppeteer = await getPuppeteer();
    let lastErr = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.browser = await puppeteer.connect({
          browserURL: this.cdpUrl,
          defaultViewport: null
        });

        const version = await this.browser.version();
        logger.info(`Attached to Brave browser via CDP: ${version}`, { cdpUrl: this.cdpUrl });
        return this.browser;
      } catch (err) {
        lastErr = err;
        logger.warn(`CDP connect attempt ${attempt}/${retries} failed: ${err.message}`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, delayMs));
        }
      }
    }

    throw new Error(`Could not connect to Brave CDP at ${this.cdpUrl}: ${lastErr?.message}`);
  }

  /**
   * Retrieves or reuses the dedicated Instagram tab in the Brave session.
   */
  async getInstagramPage(options = {}) {
    if (!this.browser || !this.browser.connected) {
      await this.connect();
    }

    if (this.isPageAlive(this._instagramPage)) {
      if (options.bringToFront !== false) {
        await this._instagramPage.bringToFront().catch(() => {});
      }
      return this._instagramPage;
    }

    let release;
    const lock = new Promise(r => (release = r));
    const prevLock = this._pageMutex;
    this._pageMutex = lock;
    await prevLock;

    try {
      if (this.isPageAlive(this._instagramPage)) {
        return this._instagramPage;
      }

      const pages = await this.browser.pages();

      // Look for an existing Instagram tab
      let selectedPage = pages.find(p => p.url().includes("instagram.com"));

      // If no tab is on Instagram, look for a blank or new tab to reuse
      if (!selectedPage) {
        selectedPage = pages.find(p => p.url() === "about:blank" || p.url().includes("newtab"));
        if (selectedPage) {
          logger.info(`Reusing blank tab to open Instagram: ${CONFIG.INSTAGRAM_HOME_URL}`);
          await selectedPage.goto(CONFIG.INSTAGRAM_HOME_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      // If still none, create a new tab in the SAME browser session
      if (!selectedPage) {
        logger.info(`Opening new tab in existing Brave session for Instagram: ${CONFIG.INSTAGRAM_HOME_URL}`);
        selectedPage = await this.browser.newPage();
        await selectedPage.goto(CONFIG.INSTAGRAM_HOME_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
        await new Promise(r => setTimeout(r, 2000));
      }

      // Clear device metrics overrides if any
      try {
        const client = await selectedPage.target().createCDPSession();
        await client.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
      } catch (e) {}

      // Handle unexpected native dialogs
      selectedPage.removeAllListeners("dialog");
      selectedPage.on("dialog", async dialog => {
        logger.warn(`Browser dialog auto-dismissed: [${dialog.type()}] "${dialog.message()}"`);
        await dialog.accept().catch(() => {});
      });

      this._instagramPage = selectedPage;
      if (options.bringToFront !== false) {
        await this._instagramPage.bringToFront().catch(() => {});
      }
      return this._instagramPage;
    } finally {
      release();
    }
  }

  disconnect() {
    if (this.browser) {
      try {
        this.browser.disconnect();
      } catch (e) {}
      this.browser = null;
    }
    this._instagramPage = null;
  }
}

const braveBrowserManager = new BraveBrowserManager();
module.exports = braveBrowserManager;
