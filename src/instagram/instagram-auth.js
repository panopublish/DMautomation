/**
 * src/instagram/instagram-auth.js
 * Verifies that the connected Brave session is authenticated on Instagram.
 * NEVER asks for passwords, NEVER automates login, NEVER touches session cookies.
 */

const CONFIG = require("../../config");
const braveBrowserManager = require("../browser/brave-browser-manager");
const logger = require("../logging/logger");

async function checkInstagramAuth(options = { printResult: true }) {
  try {
    await braveBrowserManager.connect();
    const page = await braveBrowserManager.getInstagramPage();

    if (!page.url().includes("instagram.com")) {
      await page.goto(CONFIG.INSTAGRAM_HOME_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60000
      });
      await new Promise(r => setTimeout(r, 2500));
    }

    const authState = await page.evaluate(() => {
      const url = location.href;
      const title = document.title || "";

      // 1. Detect login forms or login prompt screens
      const hasLoginForm = Boolean(
        document.querySelector('input[name="username"], input[name="password"], form#loginForm')
      );
      const isLoginUrl = url.includes("/accounts/login") || url.includes("/accounts/emailsignup");

      // 2. Detect authenticated navigation icons / attributes
      const hasDirectMessages = Boolean(
        document.querySelector('a[href*="/direct/inbox/"], svg[aria-label*="Direct" i], svg[aria-label*="Messages" i]')
      );
      const hasHomeNav = Boolean(
        document.querySelector('svg[aria-label*="Home" i], svg[aria-label*="Explore" i], svg[aria-label*="Search" i]')
      );
      const profileAvatar = document.querySelector('img[alt*="profile picture" i], a[href^="/"][role="link"] img');
      const hasProfileAvatar = Boolean(profileAvatar);

      // Extract handle if visible in avatar alt or profile link
      let detectedHandle = null;
      if (profileAvatar) {
        const alt = profileAvatar.getAttribute("alt") || "";
        const match = alt.match(/([^'s]+)'s profile picture/i);
        if (match) detectedHandle = match[1];
      }

      const isAuthenticated = !isLoginUrl && !hasLoginForm && (hasDirectMessages || hasHomeNav || hasProfileAvatar);

      return {
        url,
        title,
        isAuthenticated,
        detectedHandle,
        hasDirectMessages,
        hasHomeNav
      };
    });

    if (options.printResult) {
      console.log("\n==============================================");
      console.log("       BRAVE INSTAGRAM AUTHENTICATION");
      console.log("==============================================");
      console.log(`✓ Brave CDP Host   : ${CONFIG.BRAVE_CDP_URL}`);
      console.log(`✓ Instagram URL    : ${authState.url}`);
      console.log(`✓ Page Title       : ${authState.title}`);

      if (authState.isAuthenticated) {
        console.log(`✓ Status           : AUTHENTICATED`);
        if (authState.detectedHandle) {
          console.log(`✓ Active Account   : @${authState.detectedHandle}`);
        }
        console.log("==============================================\n");
      } else {
        console.log("❌ Status           : NOT AUTHENTICATED");
        console.log("\n[ACTION REQUIRED]:");
        console.log("Instagram is not authenticated in the connected Brave session. Please log in manually.");
        console.log("Once logged in manually inside Brave, re-run: npm run auth\n");
        console.log("==============================================\n");
      }
    }

    logger.info("Instagram authentication check", {
      isAuthenticated: authState.isAuthenticated,
      detectedHandle: authState.detectedHandle
    });

    return authState;
  } catch (err) {
    if (options.printResult) {
      console.error("\n==============================================");
      console.error("       BRAVE INSTAGRAM AUTHENTICATION");
      console.error("==============================================");
      console.error(`❌ Connection failed: ${err.message}`);
      console.error("\nTo connect, make sure Brave is launched with:");
      console.error("  brave.exe --remote-debugging-port=9222\n");
      console.error("==============================================\n");
    }
    logger.error("Instagram auth check failed", err);
    return {
      url: null,
      title: null,
      isAuthenticated: false,
      error: err.message
    };
  }
}

module.exports = {
  checkInstagramAuth
};
