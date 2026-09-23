const braveBrowserManager = require('../src/browser/brave-browser-manager');

async function testClickSidebarRow() {
  const page = await braveBrowserManager.getInstagramPage();

  console.log('Current URL before click:', page.url());

  const clicked = await page.evaluate((target) => {
    const rows = Array.from(document.querySelectorAll('div[role="button"][tabindex="0"]'));
    const match = rows.find(r => (r.innerText || '').toLowerCase().includes(target.toLowerCase()));
    if (match) {
      match.click();
      return true;
    }
    return false;
  }, '360 Trusted Virtual Tour');

  console.log('Row clicked:', clicked);
  await new Promise(r => setTimeout(r, 3000));

  console.log('Current URL after click:', page.url());

  const composer = await page.$('div[role="textbox"][contenteditable="true"]');
  console.log('Composer found after click:', Boolean(composer));

  process.exit(0);
}

testClickSidebarRow().catch(e => { console.error(e); process.exit(1); });
