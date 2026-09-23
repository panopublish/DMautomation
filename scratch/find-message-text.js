const braveBrowserManager = require('../src/browser/brave-browser-manager');

async function findMessageText() {
  const page = await braveBrowserManager.getInstagramPage();

  const messages = await page.evaluate(() => {
    // Find all reply buttons
    const replyButtons = Array.from(document.querySelectorAll('[aria-label*="Reply to message from" i]'));
    const results = [];

    for (const btn of replyButtons) {
      const aria = btn.getAttribute('aria-label');
      const senderMatch = aria.match(/Reply to message from (.+)/i);
      const sender = senderMatch ? senderMatch[1] : 'unknown';

      // Find the row containing this button
      // Walk up until we find a container that contains text
      let curr = btn;
      let text = '';
      for (let i = 0; i < 10; i++) {
        if (!curr || curr === document.body) break;
        const candidate = curr.parentElement;
        if (candidate) {
          const t = (candidate.innerText || '').trim();
          if (t && t.length > 5) {
            text = t;
            break;
          }
        }
        curr = candidate;
      }

      results.push({ sender, text: text.slice(0, 200) });
    }

    return results;
  });

  console.log('Messages extracted:', JSON.stringify(messages, null, 2));
  process.exit(0);
}

findMessageText().catch(e => { console.error(e); process.exit(1); });
