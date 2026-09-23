const braveBrowserManager = require('../src/browser/brave-browser-manager');

async function testComposer() {
  const page = await braveBrowserManager.getInstagramPage();

  const textbox = await page.$('div[role="textbox"]');
  console.log('Textbox found:', Boolean(textbox));
  if (textbox) {
    await textbox.focus();
    await textbox.click();
    console.log('Focused on textbox');
  }
  process.exit(0);
}

testComposer().catch(e => { console.error(e); process.exit(1); });
