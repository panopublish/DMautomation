/**
 * src/safety/action-verifier.js
 * Multi-signal post-condition verifier for live Instagram browser interactions.
 * Confirms that message actually appeared in permanent conversation message bubbles
 * outside any editable draft composer.
 */

const telemetry = require("../telemetry/action-telemetry");
const logger = require("../logging/logger");

class ActionVerifier {
  /**
   * Verifies that the sent message snippet exists in the conversation DOM outside the input field.
   *
   * @param {Object} page - Puppeteer page instance
   * @param {string} text - Message text that was submitted
   * @param {Object} options - { timeoutMs, targetId }
   * @returns {Promise<{ verified: boolean, reason?: string, evidence?: any }>}
   */
  static async verifyOutgoingDm(page, text, options = {}) {
    const snippet = String(text || "").trim().slice(0, 35).toLowerCase();
    if (!snippet || snippet.length < 3) {
      return { verified: false, reason: "Text too short for reliable DOM verification" };
    }

    const timeout = options.timeoutMs || 15000;
    const targetId = options.targetId || "unknown";
    const started = Date.now();

    logger.info(`[VERIFIER] Verifying message delivery in DOM for snippet: "${snippet.slice(0, 20)}..."`);

    while (Date.now() - started < timeout) {
      try {
        const checkResult = await page.evaluate((snip) => {
          // 1. Detect platform error banners (e.g. "Message failed to send", "Couldn't send", "Action blocked")
          const bodyText = (document.body ? document.body.innerText : "").toLowerCase();
          const hasError = /\b(couldn'?t send|failed to send|something went wrong|action blocked|try again later)\b/i.test(bodyText);
          if (hasError) {
            return { verified: false, error: "Platform error notification detected in page" };
          }

          // 2. Scan all text elements in the page
          const candidates = Array.from(document.querySelectorAll(
            'div[role="row"], div[dir="auto"], span, p, div[data-testid*="message"], div[class*="message"]'
          ));

          for (const el of candidates) {
            // Must NOT be inside a draft input, composer, or contenteditable element
            if (el.isContentEditable || el.closest('[contenteditable="true"], div[role="textbox"], textarea, input, form')) {
              continue;
            }

            const content = (el.innerText || el.textContent || "").toLowerCase().trim();
            if (content.includes(snip)) {
              return {
                verified: true,
                tagName: el.tagName,
                className: String(el.className || "").slice(0, 50)
              };
            }
          }

          return { verified: false, awaiting: true };
        }, snippet);

        if (checkResult.verified) {
          telemetry.record({
            type: "DM_ACTION_VERIFIED",
            state: "SENT_VERIFIED",
            verified: true,
            targetId,
            evidence: checkResult
          });
          logger.info(`[VERIFIER] ✓ Message delivery verified in DOM: tag=${checkResult.tagName}`);
          return { verified: true, state: "SENT_VERIFIED", evidence: checkResult };
        }

        if (checkResult.error) {
          const evidence = await telemetry.captureEvidence(page, { targetId, error: checkResult.error });
          telemetry.record({
            type: "DM_ACTION_FAILED",
            state: "SEND_FAILED",
            verified: false,
            targetId,
            reason: checkResult.error,
            evidence
          });
          return { verified: false, state: "SEND_FAILED", reason: checkResult.error, evidence };
        }
      } catch (err) {
        // Evaluate failure during navigation or re-render; continue polling
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    const failureEvidence = await telemetry.captureEvidence(page, {
      targetId,
      error: "Outgoing text snippet not found in permanent DOM after timeout"
    });

    telemetry.record({
      type: "DM_ACTION_UNVERIFIED",
      state: "SEND_UNVERIFIED",
      verified: false,
      targetId,
      reason: "Message snippet not detected in chat bubbles within timeout",
      evidence: failureEvidence
    });

    logger.warn(`[VERIFIER] ❌ Message delivery UNVERIFIED in DOM after ${timeout}ms.`);
    return {
      verified: false,
      state: "SEND_UNVERIFIED",
      reason: "Message snippet not detected in chat bubbles within timeout",
      evidence: failureEvidence
    };
  }
}

module.exports = ActionVerifier;
