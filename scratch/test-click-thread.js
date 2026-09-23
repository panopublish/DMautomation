const braveBrowserManager = require("../src/browser/brave-browser-manager");

async function main() {
  const page = await braveBrowserManager.getInstagramPage();

  // Find the thread button and click it
  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('div[role="button"][tabindex="0"]'));
    const threadBtn = buttons.find(b => (b.innerText || "").includes("360 Trusted Virtual Tour"));
    if (threadBtn) {
      threadBtn.click();
      return true;
    }
    return false;
  });

  console.log("Clicked thread button:", clicked);
  await new Promise(r => setTimeout(r, 3000));

  // Now check the right pane
  const chatInfo = await page.evaluate(() => {
    const url = location.href;
    const composer = document.querySelector('div[role="textbox"], div[aria-label*="Message" i], div[contenteditable="true"]');
    const messages = Array.from(document.querySelectorAll('span, div[dir="auto"], p'))
      .map(el => (el.innerText || "").trim())
      .filter(t => t.length > 5 && t.length < 200)
      .slice(-10);

    return {
      url,
      hasComposer: Boolean(composer),
      composerTag: composer ? composer.tagName : null,
      composerAria: composer ? composer.getAttribute("aria-label") : null,
      recentMessages: messages
    };
  });

  console.log("Chat Info after click:", JSON.stringify(chatInfo, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
