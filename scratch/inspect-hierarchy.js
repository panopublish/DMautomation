const braveBrowserManager = require('../src/browser/brave-browser-manager');

async function inspectSurrounding() {
  const page = await braveBrowserManager.getInstagramPage();

  const details = await page.evaluate(() => {
    const tb = document.querySelector('div[role="textbox"]');
    if (!tb) return 'No textbox';
    let curr = tb;
    const hierarchy = [];
    for (let i = 0; i < 8; i++) {
      if (!curr) break;
      hierarchy.push({
        tag: curr.tagName,
        classes: curr.className,
        role: curr.getAttribute('role'),
        ariaLabel: curr.getAttribute('aria-label'),
        textSnippet: curr.innerText ? curr.innerText.slice(0, 80) : ''
      });
      curr = curr.parentElement;
    }
    return {
      windowLocation: window.location.href,
      hierarchy
    };
  });

  console.log('Hierarchy:', JSON.stringify(details, null, 2));
  process.exit(0);
}

inspectSurrounding().catch(e => { console.error(e); process.exit(1); });
