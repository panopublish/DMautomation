const braveBrowserManager = require('../src/browser/brave-browser-manager');

async function inspectSidebar() {
  const page = await braveBrowserManager.getInstagramPage();

  const items = await page.evaluate(() => {
    // Look at the left sidebar of direct messages
    const rows = Array.from(document.querySelectorAll('div[role="button"][tabindex="0"]'));
    return rows.map((r, i) => {
      // Find any anchor tags or attributes
      const anchors = Array.from(r.querySelectorAll('a')).map(a => a.href);
      const text = r.innerText;
      const role = r.getAttribute('role');
      const ariaLabel = r.getAttribute('aria-label');
      return { index: i, text, anchors, ariaLabel };
    });
  });

  console.log('Sidebar items:', JSON.stringify(items, null, 2));
  process.exit(0);
}

inspectSidebar().catch(e => { console.error(e); process.exit(1); });
