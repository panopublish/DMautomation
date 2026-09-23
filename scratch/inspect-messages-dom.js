const braveBrowserManager = require('../src/browser/brave-browser-manager');

async function inspectMessageBubbles() {
  const page = await braveBrowserManager.getInstagramPage();

  const bubbles = await page.evaluate(() => {
    // Look for message reaction / reply buttons or message containers
    const replyButtons = Array.from(document.querySelectorAll('[aria-label*="Reply to message from" i], [aria-label*="React to message from" i]'));

    const list = [];
    for (const btn of replyButtons) {
      const aria = btn.getAttribute('aria-label') || '';
      // Find the message container associated with this button
      const row = btn.closest('div[role="row"]') || btn.closest('div[class*="x"]');
      list.push({
        ariaLabel: aria,
        btnTag: btn.tagName,
        parentRowClasses: row ? row.className.slice(0, 100) : 'none',
        textAround: row ? row.innerText.slice(0, 100) : ''
      });
    }

    // Also look for messages sent by the logged-in user (panopublish)
    const allRows = Array.from(document.querySelectorAll('div[role="row"]'));
    const rowsSample = allRows.slice(-10).map(r => ({
      text: (r.innerText || '').slice(0, 100),
      ariaLabel: r.getAttribute('aria-label'),
      htmlSnippet: r.outerHTML.slice(0, 200)
    }));

    return {
      replyButtonsSample: list.slice(0, 5),
      rowsSample
    };
  });

  console.log('Bubbles analysis:', JSON.stringify(bubbles, null, 2));
  process.exit(0);
}

inspectMessageBubbles().catch(e => { console.error(e); process.exit(1); });
