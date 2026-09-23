const braveBrowserManager = require('../src/browser/brave-browser-manager');

async function inspectLeftSidebar() {
  const page = await braveBrowserManager.getInstagramPage();

  const data = await page.evaluate(() => {
    // Find elements on the left side of the viewport
    const all = Array.from(document.querySelectorAll('*'));
    const sidebarElements = all.filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 150 && rect.width < 450 && rect.height > 50 && rect.left < 200 && rect.top > 50;
    });

    const uniqueSnippets = [];
    const seen = new Set();
    for (const el of sidebarElements) {
      const text = (el.innerText || '').trim();
      if (text && !seen.has(text) && text.length < 300) {
        seen.add(text);
        uniqueSnippets.push({
          tag: el.tagName,
          rect: { x: Math.round(el.getBoundingClientRect().x), y: Math.round(el.getBoundingClientRect().y), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) },
          text: text.slice(0, 100),
          ariaLabel: el.getAttribute('aria-label')
        });
      }
    }

    return uniqueSnippets.slice(0, 15);
  });

  console.log('Sidebar candidates:', JSON.stringify(data, null, 2));
  process.exit(0);
}

inspectLeftSidebar().catch(e => { console.error(e); process.exit(1); });
