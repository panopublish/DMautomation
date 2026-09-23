const braveBrowserManager = require('../src/browser/brave-browser-manager');

async function checkHomepageTextbox() {
  const page = await braveBrowserManager.getInstagramPage();
  console.log('Page URL:', page.url());

  const info = await page.evaluate(() => {
    const el = document.querySelector('div[role="textbox"]');
    if (!el) return null;
    return {
      placeholder: el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.innerText,
      closestForm: Boolean(el.closest('form')),
      parentText: el.parentElement ? el.parentElement.innerText.slice(0, 100) : '',
      html: el.outerHTML.slice(0, 200)
    };
  });

  console.log('Textbox info:', info);
  process.exit(0);
}

checkHomepageTextbox().catch(e => { console.error(e); process.exit(1); });
