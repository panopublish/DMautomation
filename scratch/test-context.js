const braveBrowserManager = require('../src/browser/brave-browser-manager');

async function testThreadContext() {
  const page = await braveBrowserManager.getInstagramPage();

  const data = await page.evaluate(() => {
    // 1. Current URL
    const url = window.location.href;

    // 2. Thread ID from URL
    const m = url.match(/\/direct\/t\/([^/?#]+)/);
    const activeThreadId = m ? m[1] : null;

    // 3. Conversation Header / Title
    // Let's check headers, spans, or links in the right pane header
    const mainHeader = document.querySelector('section main header') || document.querySelector('header');
    const headerTitle = mainHeader ? mainHeader.innerText : null;

    // 4. Any username links in the thread
    const userLinks = Array.from(document.querySelectorAll('a[href^="/"]')).map(a => a.getAttribute('href')).filter(h => h && !h.includes('/direct/') && !h.includes('/explore/') && !h.includes('/reels/'));

    return {
      url,
      activeThreadId,
      headerTitle,
      userLinksSample: userLinks.slice(0, 10)
    };
  });

  console.log('Thread Context:', JSON.stringify(data, null, 2));
  process.exit(0);
}

testThreadContext().catch(e => { console.error(e); process.exit(1); });
