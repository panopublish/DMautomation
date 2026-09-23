const braveBrowserManager = require("../src/browser/brave-browser-manager");

async function testNewMessageFlow(targetUsername) {
  const page = await braveBrowserManager.getInstagramPage();

  if (!page.url().includes("/direct/inbox")) {
    await page.goto("https://www.instagram.com/direct/inbox/", { waitUntil: "domcontentloaded", timeout: 45000 });
    await new Promise(r => setTimeout(r, 2500));
  }

  // 1. Click "New message" icon
  const clickedNew = await page.evaluate(() => {
    const newMsgSvg = document.querySelector('svg[aria-label="New message"]');
    if (newMsgSvg) {
      const btn = newMsgSvg.closest('div[role="button"], button') || newMsgSvg;
      btn.click();
      return true;
    }
    // Fallback: button with text "Send message"
    const sendMsgBtn = Array.from(document.querySelectorAll('div[role="button"], button')).find(b => {
      return (b.innerText || "").trim().toLowerCase() === "send message";
    });
    if (sendMsgBtn) {
      sendMsgBtn.click();
      return true;
    }
    return false;
  });

  console.log("Clicked New Message button:", clickedNew);
  await new Promise(r => setTimeout(r, 2000));

  // 2. Look for search input in modal
  const modalInfo = await page.evaluate((target) => {
    const searchInput = document.querySelector('input[placeholder*="Search" i], input[name="queryBox"]');
    if (!searchInput) return { hasModal: false };

    searchInput.focus();
    return { hasModal: true, placeholder: searchInput.placeholder };
  }, targetUsername);

  console.log("Modal Search Input Info:", modalInfo);

  if (modalInfo.hasModal) {
    // Type the target username
    await page.keyboard.type(targetUsername, { delay: 50 });
    console.log(`Typed username "${targetUsername}" into search box`);
    await new Promise(r => setTimeout(r, 2500));

    // Inspect search results
    const results = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('div[role="button"], div[role="checkbox"], span'))
        .map(el => (el.innerText || "").trim())
        .filter(t => t.length > 2 && t.length < 50);
      return rows.slice(0, 15);
    });
    console.log("Search dropdown results:", results);
  }

  process.exit(0);
}

// Test with the creator already in their inbox: "360tvt"
testNewMessageFlow("360tvt").catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
