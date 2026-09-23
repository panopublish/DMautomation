const braveBrowserManager = require('../src/browser/brave-browser-manager');

async function listTabs() {
  const browser = await braveBrowserManager.connect();
  const pages = await browser.pages();
  console.log(`Found ${pages.length} pages in Brave:`);
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    console.log(`Tab [${i}]: title="${await p.title()}", url="${p.url()}"`);
  }
  process.exit(0);
}

listTabs().catch(e => { console.error(e); process.exit(1); });
