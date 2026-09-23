const braveBrowserManager = require('../src/browser/brave-browser-manager');

async function testNewMessageModal() {
  const page = await braveBrowserManager.getInstagramPage();

  console.log('Navigating to inbox...');
  await page.goto('https://www.instagram.com/direct/inbox/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  console.log('Searching for New Message button/icon...');
  const clickedNewMessage = await page.evaluate(() => {
    // Look for svg with aria-label="New message"
    const svg = document.querySelector('svg[aria-label="New message"]');
    if (svg) {
      const btn = svg.closest('div[role="button"], button') || svg;
      btn.click();
      return 'Clicked SVG new message';
    }
    const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
    const sendBtn = buttons.find(b => (b.innerText || '').toLowerCase().includes('send message'));
    if (sendBtn) {
      sendBtn.click();
      return 'Clicked Send message button';
    }
    return 'Not found';
  });

  console.log('New message trigger result:', clickedNewMessage);
  await new Promise(r => setTimeout(r, 2000));

  const dialog = await page.$('div[role="dialog"]');
  console.log('Dialog present:', Boolean(dialog));

  if (dialog) {
    const input = await page.$('input[placeholder*="Search" i]');
    console.log('Search input present in dialog:', Boolean(input));
    if (input) {
      await input.focus();
      await page.keyboard.type('360tvt', { delay: 40 });
      await new Promise(r => setTimeout(r, 3000));

      const searchResults = await page.evaluate(() => {
        const dialogEl = document.querySelector('div[role="dialog"]');
        if (!dialogEl) return [];
        const candidates = Array.from(dialogEl.querySelectorAll('div[role="button"], span, div')).filter(el => {
          return (el.innerText || '').toLowerCase().includes('360tvt');
        });
        return candidates.map(c => c.innerText.slice(0, 50));
      });
      console.log('Search results in modal:', searchResults);

      // Close modal by clicking Close / SVG or Esc
      await page.keyboard.press('Escape');
    }
  }

  process.exit(0);
}

testNewMessageModal().catch(e => { console.error(e); process.exit(1); });
