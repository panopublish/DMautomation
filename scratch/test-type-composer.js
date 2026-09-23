const braveBrowserManager = require('../src/browser/brave-browser-manager');

async function testTyping() {
  const page = await braveBrowserManager.getInstagramPage();

  const textbox = await page.$('div[role="textbox"][contenteditable="true"]');
  if (!textbox) {
    console.error('No textbox found');
    process.exit(1);
  }

  await textbox.focus();
  await textbox.click();
  await new Promise(r => setTimeout(r, 300));

  // Type test text
  await page.keyboard.type('PanoPublish test check', { delay: 30 });
  await new Promise(r => setTimeout(r, 500));

  const textInside = await page.evaluate(() => {
    const tb = document.querySelector('div[role="textbox"][contenteditable="true"]');
    return tb ? tb.innerText : null;
  });

  console.log('Text typed inside composer:', textInside);

  // Clear it back so we don't leave junk
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await new Promise(r => setTimeout(r, 300));

  const textAfterClear = await page.evaluate(() => {
    const tb = document.querySelector('div[role="textbox"][contenteditable="true"]');
    return tb ? tb.innerText : null;
  });

  console.log('Text after clear:', JSON.stringify(textAfterClear));
  process.exit(0);
}

testTyping().catch(e => { console.error(e); process.exit(1); });
