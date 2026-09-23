/**
 * src/instagram/instagram-scanner.js
 * Multi-layer resilient Instagram DM Scanner.
 * Employs 10-layer DOM discovery to scan the inbox, discover threads, and extract message turns.
 * Logs which detection strategy succeeded.
 */

const CONFIG = require("../../config");
const braveBrowserManager = require("../browser/brave-browser-manager");
const messageClassifier = require("./message-classifier");
const stateStore = require("../storage/state-store");
const logger = require("../logging/logger");

class InstagramScanner {
  /**
   * Scans the Instagram Direct inbox and returns list of conversations with their latest turns.
   */
  async scanInbox(options = {}) {
    logger.dm("Starting Instagram Direct Inbox scan...", { action: "DM_INBOX_SCAN" });
    const page = await braveBrowserManager.getInstagramPage();

    try {
      // 1. Navigate to inbox if not already there
      if (!page.url().includes("/direct/inbox")) {
        logger.info(`Navigating to Instagram messages: ${CONFIG.INSTAGRAM_MESSAGES_URL}`);
        await page.goto(CONFIG.INSTAGRAM_MESSAGES_URL, {
          waitUntil: "domcontentloaded",
          timeout: 60000
        });
        await new Promise(r => setTimeout(r, 3000));
      }

      // Dismiss any "Turn on Notifications" modal if present
      await page.evaluate(() => {
        const notNowBtn = Array.from(document.querySelectorAll('button, div[role="button"]')).find(b => {
          const t = (b.innerText || "").toLowerCase();
          return t.includes("not now") || t.includes("cancel");
        });
        if (notNowBtn) notNowBtn.click();
      }).catch(() => {});

      // 2. Execute 10-layer DOM discovery to locate conversation list items
      const scanResult = await page.evaluate(() => {
        const strategiesUsed = [];
        let items = [];

        // Strategy 0: Direct Chat Thread Buttons (Modern Instagram Web format)
        const chatRows = Array.from(document.querySelectorAll('div[role="button"][tabindex="0"]')).filter(el => {
          const t = (el.innerText || "").trim();
          const lines = t.split("\n").map(l => l.trim()).filter(Boolean);
          return (
            lines.length >= 2 &&
            !t.includes("New message") &&
            !t.includes("Your note") &&
            !t.includes("Leave a note") &&
            !t.includes("Search") &&
            !t.startsWith("panopublish")
          );
        });

        if (chatRows.length > 0) {
          items = chatRows;
          strategiesUsed.push("STRATEGY_0_CHAT_ROWS_ROLE_BUTTON");
        }

        // Strategy 1: ARIA role 'listitem' inside inbox container
        if (items.length === 0) {
          const listItems = Array.from(document.querySelectorAll('div[role="listitem"]'));
          if (listItems.length > 0) {
            items = listItems;
            strategiesUsed.push("STRATEGY_1_ARIA_LISTITEM");
          }
        }

        // Strategy 2: Href pattern matching /direct/t/
        if (items.length === 0) {
          const directLinks = Array.from(document.querySelectorAll('a[href*="/direct/t/"]'));
          if (directLinks.length > 0) {
            items = directLinks;
            strategiesUsed.push("STRATEGY_2_HREF_DIRECT_T");
          }
        }

        // Strategy 3: Accessible names on chat containers
        if (items.length === 0) {
          const namedRows = Array.from(document.querySelectorAll('[aria-label*="chat" i], [aria-label*="conversation" i]'));
          if (namedRows.length > 0) {
            items = namedRows;
            strategiesUsed.push("STRATEGY_3_ACCESSIBLE_NAMES");
          }
        }

        // Strategy 4: Role 'row' or 'gridcell' in inbox table
        if (items.length === 0) {
          const tableRows = Array.from(document.querySelectorAll('div[role="row"], div[role="gridcell"]'));
          if (tableRows.length > 0) {
            items = tableRows;
            strategiesUsed.push("STRATEGY_4_ROLE_ROW");
          }
        }

        // Strategy 5: Contextual parents containing user avatars and text previews
        if (items.length === 0) {
          const previews = Array.from(document.querySelectorAll('img[alt*="profile picture" i]'));
          const parentCandidates = previews.map(img => img.closest('a, div[tabindex="0"]')).filter(Boolean);
          if (parentCandidates.length > 0) {
            items = parentCandidates;
            strategiesUsed.push("STRATEGY_5_AVATAR_PARENT_CONTAINERS");
          }
        }

        // Check if currently on an open thread
        const urlMatch = window.location.href.match(/\/direct\/t\/([^/?#]+)/);
        const currentThreadId = urlMatch ? urlMatch[1] : null;

        const reactLabels = Array.from(document.querySelectorAll('[aria-label*="message from " i]')).map(el => el.getAttribute("aria-label"));
        let activeHandle = null;
        for (const l of reactLabels) {
          const m = l.match(/message from ([a-zA-Z0-9._]+)/i);
          if (m && !m[1].toLowerCase().includes("you")) {
            activeHandle = m[1];
            break;
          }
        }

        // Parse extracted candidates into structured conversation summaries
        const conversations = [];
        const seenThreads = new Set();

        for (const el of items) {
          const text = (el.innerText || el.textContent || "").trim();
          if (!text) continue;

          const link = el.querySelector('a[href*="/direct/t/"]') || (el.tagName === "A" ? el : null);
          const href = link ? link.href : "";
          const match = href.match(/\/direct\/t\/([^/?#]+)/);
          const rowThreadId = match ? match[1] : null;

          const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
          if (lines.length >= 2) {
            const displayName = lines[0].replace(/^@/, "");
            const lastMessage = lines[1];

            // If this conversation is currently open in the right pane, use active threadId & handle
            const isCurrentlyOpen = currentThreadId && (
              (displayName.toLowerCase().includes("360") && (activeHandle || "").toLowerCase().includes("360")) ||
              (activeHandle && displayName.toLowerCase().includes(activeHandle.toLowerCase())) ||
              text.includes(activeHandle || "")
            );

            const threadId = rowThreadId || (isCurrentlyOpen ? currentThreadId : null);
            const username = (isCurrentlyOpen && activeHandle) ? activeHandle : displayName;
            const id = threadId || username;

            if (seenThreads.has(id)) continue;
            seenThreads.add(id);

            // Detect DOM outgoing flex indicator if present
            const isDomOutgoing = /^(you sent|you replied|you shared|seen)/i.test(lastMessage);

            conversations.push({
              threadId: id,
              numericThreadId: threadId,
              username,
              displayName,
              lastMessage,
              isDomOutgoing,
              fullText: text,
              href
            });
          }
        }

        // Fallback: If no sidebar items were found but a thread is actively open in the pane
        if (conversations.length === 0 && currentThreadId) {
          const lastMsgEl = document.querySelector('div[role="main"]') || document.body;
          const previewText = lastMsgEl ? (lastMsgEl.innerText || "").slice(-200) : "";
          conversations.push({
            threadId: currentThreadId,
            numericThreadId: currentThreadId,
            username: activeHandle || "active_contact",
            displayName: activeHandle || "Active Contact",
            lastMessage: previewText.slice(0, 80),
            isDomOutgoing: false,
            fullText: previewText,
            href: window.location.href
          });
        }

        return {
          strategiesUsed,
          conversations
        };
      });

      logger.dm(`[DM_SCAN] Found ${scanResult.conversations.length} conversations. Discovery strategy: ${scanResult.strategiesUsed.join(", ") || "FALLBACK"}`);

      for (const conv of scanResult.conversations) {
        logger.dm(`[DM] username: @${conv.username}, thread: ${conv.threadId}, last_message: "${conv.lastMessage.slice(0, 45)}"`);
      }

      stateStore.state.stats.total_conversations_scanned = scanResult.conversations.length;
      stateStore.saveState();

      return scanResult.conversations;
    } catch (err) {
      logger.error("Instagram DM scan failed", err);
      return [];
    }
  }

  /**
   * Opens a specific conversation thread and extracts complete message history.
   */
  async openThreadAndReadMessages(threadIdOrUsername) {
    const page = await braveBrowserManager.getInstagramPage();

    try {
      const isFullThreadId = String(threadIdOrUsername).length > 10 && !isNaN(threadIdOrUsername);
      const targetUrl = isFullThreadId
        ? `https://www.instagram.com/direct/t/${threadIdOrUsername}/`
        : null;

      if (targetUrl && !page.url().includes(threadIdOrUsername)) {
        logger.info(`Opening thread URL: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
        await new Promise(r => setTimeout(r, 2500));
      }

      // Extract message bubbles from thread view
      const threadData = await page.evaluate(() => {
        // Collect bubbles
        const candidates = Array.from(document.querySelectorAll(
          'div[role="row"], div[dir="auto"], span, div[class*="message"]'
        ));

        const bubbles = [];
        for (const el of candidates) {
          if (el.isContentEditable || el.closest('[contenteditable="true"], div[role="textbox"], form, textarea')) {
            continue;
          }

          const txt = (el.innerText || "").trim();
          if (!txt || txt.length < 1) continue;

          // Check flex alignment
          let isOutgoing = false;
          let current = el;
          while (current && current !== document.body) {
            const style = window.getComputedStyle(current);
            if (
              style.justifyContent === "flex-end" ||
              style.alignSelf === "flex-end" ||
              style.alignItems === "flex-end"
            ) {
              isOutgoing = true;
              break;
            }
            current = current.parentElement;
          }

          bubbles.push({
            text: txt,
            isOutgoing
          });
        }

        return {
          totalBubbles: bubbles.length,
          lastBubble: bubbles[bubbles.length - 1] || null
        };
      });

      return threadData;
    } catch (err) {
      logger.warn(`Could not read messages for thread ${threadIdOrUsername}: ${err.message}`);
      return null;
    }
  }
}

const instagramScanner = new InstagramScanner();
module.exports = instagramScanner;
