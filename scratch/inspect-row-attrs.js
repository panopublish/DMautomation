const braveBrowserManager = require('../src/browser/brave-browser-manager');

async function inspectRowAttrs() {
  const page = await braveBrowserManager.getInstagramPage();

  const data = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('div[role="button"][tabindex="0"]'));
    const matched = buttons.filter(b => b.innerText.includes('360'));

    if (matched.length === 0) return 'No matched row';

    const row = matched[0];
    const attrs = {};
    for (const attr of row.attributes) {
      attrs[attr.name] = attr.value;
    }

    // Check all descendent elements and their attributes
    const allDescendants = Array.from(row.querySelectorAll('*'));
    const interesting = [];
    for (const el of allDescendants) {
      for (const attr of el.attributes) {
        if (attr.name.includes('data') || attr.name.includes('id') || attr.name.includes('href') || attr.name.includes('key')) {
          interesting.push({ tag: el.tagName, attr: attr.name, value: attr.value });
        }
      }
    }

    return {
      rowAttrs: attrs,
      interesting: interesting.slice(0, 30)
    };
  });

  console.log('Row attributes:', JSON.stringify(data, null, 2));
  process.exit(0);
}

inspectRowAttrs().catch(e => { console.error(e); process.exit(1); });
