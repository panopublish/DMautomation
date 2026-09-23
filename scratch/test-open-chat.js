const braveBrowserManager = require("../src/browser/brave-browser-manager");

async function openChatWithTarget(cleanTarget) {
  const page = await braveBrowserManager.getInstagramPage();

  if (!page.url().includes("/direct/inbox")) {
    await page.goto("https://www.instagram.com/direct/inbox/", { waitUntil: "domcontentloaded", timeout: 45000 });
    await new Promise(r => setTimeout(r, 2500));
  }

  // 1. Check if target is already visible in the inbox sidebar
  const clickedInSidebar = await page.evaluate((target) => {
    const rows = Array.from(document.querySelectorAll('div[role="button"][tabindex="0"]'));
    const match = rows.find(r => (r.innerText || "").toLowerCase().includes(target.toLowerCase()));
    if (match) {
      match.click();
      return true;
    }
    return false;
  }, cleanTarget);

  if (clickedInSidebar) {
    console.log(`✓ Clicked @${cleanTarget} directly from inbox list`);
  } else {
    // 2. Click "New message" modal
    const clickedNew = await page.evaluate(() => {
      const svg = document.querySelector('svg[aria-label="New message"]');
      if (svg) {
        const btn = svg.closest('div[role="button"], button') || svg;
        btn.click();
        return true;
      }
      return false;
    });

    console.log("Clicked New Message icon:", clickedNew);
    await new Promise(r => setTimeout(r, 1500));

    // Type target in search box
    const searchInput = await page.waitForSelector('input[placeholder*="Search" i]', { timeout: 8000 }).catch(() => null);
    if (searchInput) {
      await searchInput.focus();
      await page.keyboard.type(cleanTarget, { delay: 40 });
      console.log(`Typed ${cleanTarget} into search box`);
      await new Promise(r => setTimeout(r, 2000));

      // Click the result in the modal
      const selected = await page.evaluate((target) => {
        const modal = document.querySelector('div[role="dialog"]');
        if (!modal) return false;
        // Find row matching target or first user row
        const candidates = Array.from(modal.querySelectorAll('div[role="button"], span, div')).filter(el => {
          const t = (el.innerText || "").toLowerCase();
          return t.includes(target.toLowerCase());
        });
        if (candidates.length > 0) {
          const clickTarget = candidates[0].closest('div[role="button"]') || candidates[0];
          clickTarget.click();
          return true;
        }
        return false;
      }, cleanTarget);

      console.log("Selected user in search modal:", selected);
      await new Promise(r => setTimeout(r, 1000));

      // Click "Chat" button
      const clickedChat = await page.evaluate(() => {
        const modal = document.querySelector('div[role="dialog"]');
        if (!modal) return false;
        const btns = Array.from(modal.querySelectorAll('button, div[role="button"]'));
        const chatBtn = btns.find(b => (b.innerText || "").trim().toLowerCase() === "chat");
        if (chatBtn) {
          chatBtn.click();
          return true;
        }
        return false;
      });

      console.log("Clicked Chat button:", clickedChat);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // 3. Confirm composer textbox is ready
  const composerReady = await page.evaluate(() => {
    const tb = document.querySelector('div[role="textbox"]');
    return Boolean(tb);
  });

  console.log("Composer ready on right side:", composerReady);
  process.exit(0);
}

openChatWithTarget("360tvt").catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
