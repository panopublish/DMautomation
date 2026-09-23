/**
 * src/instagram/instagram-sender.js
 * Live Instagram message sender using the attached Brave browser session.
 * Simulates human typing, enforces pre-send checks, and requires DOM verification.
 */

const CONFIG = require("../../config");
const braveBrowserManager = require("../browser/brave-browser-manager");
const duplicateGuard = require("../safety/duplicate-guard");
const rateLimiter = require("../safety/rate-limiter");
const actionVerifier = require("../safety/action-verifier");
const stateStore = require("../storage/state-store");
const logger = require("../logging/logger");

class InstagramSender {
  /**
   * Sends a direct message live in the Instagram conversation with full pre and post-send guarantees.
   *
   * @param {Object} params - {
   *   threadIdOrUsername: string,
   *   messageText: string,
   *   account?: string,
   *   forceLive?: boolean
   * }
   */
  async sendMessage(params) {
    const {
      threadIdOrUsername,
      messageText,
      account = CONFIG.DEFAULT_ACCOUNT_ID,
      forceLive = false
    } = params;

    const isDryRun = params.forceDryRun ? true : (forceLive ? false : CONFIG.DRY_RUN);
    const isPostingEnabled = params.forceDryRun ? false : (forceLive ? true : CONFIG.POSTING_ENABLED);

    logger.dm(`Preparing DM response to @${threadIdOrUsername}...`, { action: "DM_PREPARE" });

    // 1. Check duplicate guard
    const dupCheck = duplicateGuard.canExecuteReply({
      account,
      convId: threadIdOrUsername,
      sender: threadIdOrUsername,
      incomingText: params.incomingText || "",
      proposedReply: messageText
    });

    if (!dupCheck.allowed) {
      logger.warn(`[SENDER] Duplicate blocked: ${dupCheck.reason}`);
      return { success: false, reason: dupCheck.reason, duplicateBlocked: true };
    }

    // 2. Check rate limit
    const rateCheck = rateLimiter.canPerformDmReply();
    if (!rateCheck.allowed && !isDryRun) {
      logger.warn(`[SENDER] Rate limit reached: ${rateCheck.reason}`);
      return { success: false, reason: rateCheck.reason, rateLimited: true };
    }

    // 3. Dry-Run / Simulation mode guard
    if (isDryRun || !isPostingEnabled) {
      const mode = isDryRun ? "DRY_RUN" : "POSTING_DISABLED";
      logger.info(`[SENDER] ${mode} mode active: Simulated send to @${threadIdOrUsername}`);

      stateStore.recordOutgoingMessage(threadIdOrUsername, messageText, "SIMULATED", account);
      stateStore.recordHandledTurn(dupCheck.turnId, {
        username: threadIdOrUsername,
        responseText: messageText,
        mode
      });

      return {
        success: true,
        dryRun: true,
        turnId: dupCheck.turnId,
        message: messageText
      };
    }

    // 4. Live Browser Execution
    logger.dm(`Executing LIVE browser message send to @${threadIdOrUsername}...`);
    const page = await braveBrowserManager.getInstagramPage();
    await page.bringToFront().catch(() => {});

    try {
      // 1. Determine target type
      const isNumericThreadId = String(threadIdOrUsername).length > 10 && /^\d+$/.test(String(threadIdOrUsername).trim());
      const cleanTarget = String(threadIdOrUsername).replace(/^@/, "").trim();

      const prevUrl = page.url();

      if (isNumericThreadId) {
        // ----- STRATEGY A: Direct thread URL navigation -----
        logger.info(`[SENDER] Navigating to numeric thread: /direct/t/${cleanTarget}/`);
        await page.goto(`https://www.instagram.com/direct/t/${cleanTarget}/`, {
          waitUntil: "domcontentloaded",
          timeout: 45000
        });
        await new Promise(r => setTimeout(r, 3500));

      } else {
        // ----- STRATEGY B: Username-based — navigate to profile, click Message -----
        logger.info(`[SENDER] Opening profile to find DM thread for @${cleanTarget}...`);
        await page.goto(`https://www.instagram.com/${cleanTarget}/`, {
          waitUntil: "domcontentloaded",
          timeout: 30000
        });
        await new Promise(r => setTimeout(r, 3000));

        // Check if profile exists (404 guard)
        const profileOk = await page.evaluate(() => {
          const bodyText = (document.body ? document.body.innerText : "").toLowerCase();
          return !bodyText.includes("sorry, this page isn't available") &&
                 !bodyText.includes("the link you followed may be broken");
        });

        if (!profileOk) {
          return {
            success: false,
            error: `Instagram profile @${cleanTarget} does not exist or is private.`,
            profileNotFound: true
          };
        }

        // Find and click the Message button on profile
        const clickedMessage = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button, div[role="button"], a'));
          const messageBtn = btns.find(b => {
            const t = (b.innerText || b.textContent || "").trim().toLowerCase();
            return t === "message" || t === "send message";
          });
          if (messageBtn) {
            messageBtn.click();
            return true;
          }
          return false;
        });

        if (clickedMessage) {
          logger.info(`[SENDER] Clicked 'Message' button on @${cleanTarget}'s profile`);
          await new Promise(r => setTimeout(r, 3500));
        } else {
          // Fallback: try New Message modal from inbox
          logger.info(`[SENDER] Message button not found on profile — trying New Message modal...`);
          await page.goto("https://www.instagram.com/direct/inbox/", {
            waitUntil: "domcontentloaded",
            timeout: 30000
          });
          await new Promise(r => setTimeout(r, 3000));

          // Check sidebar first
          const clickedInSidebar = await page.evaluate((target) => {
            const rows = Array.from(document.querySelectorAll('div[role="button"][tabindex="0"]'));
            const match = rows.find(r => (r.innerText || "").toLowerCase().includes(target.toLowerCase()));
            if (match) { match.click(); return true; }
            return false;
          }, cleanTarget);

          if (clickedInSidebar) {
            logger.info(`[SENDER] Found @${cleanTarget} in sidebar — clicked`);
            await new Promise(r => setTimeout(r, 3000));
          } else {
            // Try New Message modal
            await page.evaluate(() => {
              const svg = document.querySelector('svg[aria-label="New message"]');
              if (svg) {
                const btn = svg.closest('div[role="button"], button') || svg;
                btn.click();
              }
            });
            await new Promise(r => setTimeout(r, 2000));

            const searchInput = await page.waitForSelector('input[placeholder*="Search" i]', { timeout: 8000 }).catch(() => null);
            if (searchInput) {
              await searchInput.focus();
              await page.keyboard.type(cleanTarget, { delay: 40 });
              await new Promise(r => setTimeout(r, 2500));

              // Pick the BEST matching result — exact username match preferred
              const picked = await page.evaluate((target) => {
                const modal = document.querySelector('div[role="dialog"]');
                if (!modal) return false;
                const allEls = Array.from(modal.querySelectorAll('*'));
                // Find elements whose text exactly matches the handle
                const exactMatch = allEls.find(el => {
                  const t = (el.innerText || "").trim().toLowerCase();
                  return t === target.toLowerCase() || t === `@${target.toLowerCase()}`;
                });
                if (exactMatch) {
                  const clickable = exactMatch.closest('div[role="button"]') || exactMatch;
                  clickable.click();
                  return true;
                }
                // Fallback: contains match
                const loose = allEls.find(el => (el.innerText || "").toLowerCase().includes(target.toLowerCase()));
                if (loose) {
                  const clickable = loose.closest('div[role="button"]') || loose;
                  clickable.click();
                  return true;
                }
                return false;
              }, cleanTarget);

              if (!picked) {
                return {
                  success: false,
                  error: `@${cleanTarget} was not found in Instagram's search. Verify the username exists.`,
                  notFound: true
                };
              }

              await new Promise(r => setTimeout(r, 1200));

              // Click "Chat" button
              await page.evaluate(() => {
                const modal = document.querySelector('div[role="dialog"]');
                if (!modal) return;
                const chatBtn = Array.from(modal.querySelectorAll('button, div[role="button"]'))
                  .find(b => (b.innerText || "").trim().toLowerCase() === "chat");
                if (chatBtn) chatBtn.click();
              });
              await new Promise(r => setTimeout(r, 3500));
            }
          }
        }
      }

      // ---- CRITICAL: Verify navigation actually reached a DM thread ----
      const newUrl = page.url();
      logger.info(`[SENDER] URL after navigation: ${newUrl}`);

      if (!newUrl.includes("/direct/t/")) {
        return {
          success: false,
          error: `Navigation to @${cleanTarget} failed — not on a DM thread (URL: ${newUrl})`,
          navigationFailed: true
        };
      }

      // Extra check: if we ended up on the SAME thread as before (wrong target), bail
      if (newUrl === prevUrl && !isNumericThreadId) {
        return {
          success: false,
          error: `Instagram DM thread did not change — still on previous conversation. @${cleanTarget} may not exist.`,
          navigationFailed: true
        };
      }

      // Check for platform restrictions
      const restriction = await page.evaluate(() => {
        const body = (document.body ? document.body.innerText : "").toLowerCase();
        if (body.includes("can't message this account") || body.includes("cannot be messaged")) {
          return "ACCOUNT_NOT_MESSAGEABLE";
        }
        return null;
      });

      if (restriction) {
        logger.warn(`[SENDER] Platform restriction: ${restriction}`);
        return { success: false, restricted: true, restriction, reason: `Platform restriction: ${restriction}` };
      }

      // ---- Locate the composer ----
      const composerSelector = 'div[role="textbox"][contenteditable="true"][aria-placeholder="Message..."], div[role="textbox"][contenteditable="true"], div[role="textbox"]';
      const inputEl = await page.waitForSelector(composerSelector, { timeout: 15000 }).catch(() => null);

      if (!inputEl) {
        throw new Error(`Could not find message composer for @${cleanTarget} on Instagram.`);
      }

      await inputEl.click();
      await inputEl.focus();
      await new Promise(r => setTimeout(r, 400));

      // Clear any existing text first
      await page.keyboard.down("Control");
      await page.keyboard.press("KeyA");
      await page.keyboard.up("Control");
      await new Promise(r => setTimeout(r, 100));

      // Type message
      logger.info(`[SENDER] Typing message to @${cleanTarget} (${messageText.length} chars)...`);
      await page.keyboard.type(messageText, { delay: 20 });
      await new Promise(r => setTimeout(r, 800));

      // Send via Enter
      await page.keyboard.press("Enter");
      await new Promise(r => setTimeout(r, 1000));

      // Fallback Send button if textbox still has text
      await page.evaluate(() => {
        const tb = document.querySelector('div[role="textbox"][contenteditable="true"]');
        if (tb && (tb.innerText || "").trim().length > 0) {
          const sendBtn = Array.from(document.querySelectorAll('button, div[role="button"]')).find(b => {
            const t = (b.innerText || "").trim().toLowerCase();
            const aria = (b.getAttribute("aria-label") || "").toLowerCase();
            return t === "send" || aria === "send" || Boolean(b.querySelector('svg[aria-label*="Send" i]'));
          });
          if (sendBtn) sendBtn.click();
        }
      }).catch(() => {});

      // 5. Mandatory DOM Post-Send Verification
      const verifyResult = await actionVerifier.verifyOutgoingDm(page, messageText, {
        targetId: threadIdOrUsername,
        timeoutMs: 15000
      });

      if (verifyResult.verified) {
        // Record verified send
        stateStore.recordOutgoingMessage(threadIdOrUsername, messageText, "SENT_VERIFIED", account);
        stateStore.recordHandledTurn(dupCheck.turnId, {
          username: threadIdOrUsername,
          responseText: messageText,
          status: "SENT_VERIFIED"
        });
        rateLimiter.recordDmReply(threadIdOrUsername, { text: messageText });

        logger.dm(`[SENDER] ✓ Live DM to @${threadIdOrUsername} SENT and VERIFIED in DOM.`);
        return {
          success: true,
          verified: true,
          state: "SENT_VERIFIED",
          turnId: dupCheck.turnId,
          message: messageText
        };
      } else {
        // Mark SEND_UNVERIFIED and do not retry blindly
        stateStore.recordOutgoingMessage(threadIdOrUsername, messageText, "SEND_UNVERIFIED", account);
        logger.warn(`[SENDER] ❌ Message delivery was UNVERIFIED in DOM. Marked as SEND_UNVERIFIED.`);
        return {
          success: false,
          verified: false,
          state: "SEND_UNVERIFIED",
          reason: verifyResult.reason || "DOM bubble verification failed"
        };
      }
    } catch (err) {
      logger.error(`Live DM send failed for @${threadIdOrUsername}`, err);
      return { success: false, error: err.message };
    }
  }
}

const instagramSender = new InstagramSender();
module.exports = instagramSender;
