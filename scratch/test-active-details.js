const braveBrowserManager = require('../src/browser/brave-browser-manager');

async function testScanActiveThread() {
  const page = await braveBrowserManager.getInstagramPage();

  const data = await page.evaluate(() => {
    const url = window.location.href;
    const urlMatch = url.match(/\/direct\/t\/([^/?#]+)/);
    const threadId = urlMatch ? urlMatch[1] : null;

    const reactLabels = Array.from(document.querySelectorAll('[aria-label*="message from " i]')).map(el => el.getAttribute('aria-label'));
    let handle = null;
    for (const l of reactLabels) {
      const m = l.match(/message from ([a-zA-Z0-9._]+)/i);
      if (m) { handle = m[1]; break; }
    }

    return { url, threadId, handle };
  });

  console.log('Detected active thread details:', data);
  process.exit(0);
}

testScanActiveThread().catch(e => { console.error(e); process.exit(1); });
