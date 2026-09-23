const braveBrowserManager = require('../src/browser/brave-browser-manager');

async function testNavigateToThread() {
  const page = await braveBrowserManager.getInstagramPage();
  console.log('Current URL before:', page.url());

  console.log('Navigating to: https://www.instagram.com/direct/t/17842356972644031/');
  await page.goto('https://www.instagram.com/direct/t/17842356972644031/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  await new Promise(r => setTimeout(r, 4000));
  console.log('Current URL after:', page.url());

  const info = await page.evaluate(() => {
    const composer = document.querySelector('div[role="textbox"][contenteditable="true"]');
    const header = document.querySelector('header, div[role="heading"]');
    return {
      hasComposer: Boolean(composer),
      composerPlaceholder: composer ? (composer.getAttribute('aria-placeholder') || composer.getAttribute('aria-label')) : null,
      headerText: header ? header.innerText : 'null'
    };
  });

  console.log('Result:', JSON.stringify(info, null, 2));
  process.exit(0);
}

testNavigateToThread().catch(e => { console.error(e); process.exit(1); });
