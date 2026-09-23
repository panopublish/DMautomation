const braveBrowserManager = require('../src/browser/brave-browser-manager');

async function inspect() {
  const page = await braveBrowserManager.getInstagramPage();
  console.log('Current URL:', page.url());
  const title = await page.title();
  console.log('Page Title:', title);

  const info = await page.evaluate(() => {
    const textboxes = Array.from(document.querySelectorAll('div[role="textbox"]'));
    const contenteditables = Array.from(document.querySelectorAll('[contenteditable="true"]'));
    const dialogs = Array.from(document.querySelectorAll('div[role="dialog"]'));
    const chatButtons = Array.from(document.querySelectorAll('div[role="button"][tabindex="0"]')).map(el => el.innerText.trim());

    // Also look for direct thread indicators
    const threadUrl = window.location.href;
    const bodySnippet = document.body ? document.body.innerText.substring(0, 500) : '';

    return {
      url: threadUrl,
      textboxesCount: textboxes.length,
      contenteditablesCount: contenteditables.length,
      dialogsCount: dialogs.length,
      chatButtonsSample: chatButtons.slice(0, 5),
      bodySnippet
    };
  });

  console.log('DOM Info:', JSON.stringify(info, null, 2));
  process.exit(0);
}

inspect().catch(err => {
  console.error('Inspection error:', err);
  process.exit(1);
});
