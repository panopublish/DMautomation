const braveBrowserManager = require('../src/browser/brave-browser-manager');

async function checkInboxDOM() {
  const page = await braveBrowserManager.getInstagramPage();

  const details = await page.evaluate(() => {
    // Check all clickable buttons in the inbox sidebar
    const buttons = Array.from(document.querySelectorAll('div[role="button"][tabindex="0"]'));
    const rows = buttons.map(b => {
      const text = b.innerText;
      const links = Array.from(b.querySelectorAll('a')).map(a => a.href);
      return {
        text,
        links,
        htmlSnippet: b.innerHTML.slice(0, 300)
      };
    });

    // Check current thread header / info
    const headerEl = document.querySelector('header, div[role="heading"], div[aria-label*="conversation" i]');
    const headerText = headerEl ? headerEl.innerText : 'null';

    // Check composer element details
    const textbox = document.querySelector('div[role="textbox"]');
    const textboxInfo = textbox ? {
      role: textbox.getAttribute('role'),
      contenteditable: textbox.getAttribute('contenteditable'),
      ariaLabel: textbox.getAttribute('aria-label'),
      innerText: textbox.innerText,
      innerHTML: textbox.innerHTML
    } : null;

    return {
      currentUrl: window.location.href,
      rows: rows.filter(r => r.text.includes('360')),
      headerText,
      textboxInfo
    };
  });

  console.log('Details:', JSON.stringify(details, null, 2));
  process.exit(0);
}

checkInboxDOM().catch(e => { console.error(e); process.exit(1); });
