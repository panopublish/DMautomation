const braveBrowserManager = require('../src/browser/brave-browser-manager');

async function checkAllAria() {
  const page = await braveBrowserManager.getInstagramPage();

  const labels = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[aria-label]'));
    return els
      .map(e => e.getAttribute('aria-label'))
      .filter(l => l && (l.toLowerCase().includes('message') || l.toLowerCase().includes('sent') || l.toLowerCase().includes('react') || l.toLowerCase().includes('reply')));
  });

  console.log('Relevant aria labels:', labels);
  process.exit(0);
}

checkAllAria().catch(e => { console.error(e); process.exit(1); });
