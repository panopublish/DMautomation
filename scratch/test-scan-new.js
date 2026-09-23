const instagramScanner = require('../src/instagram/instagram-scanner');

async function testScan() {
  const conversations = await instagramScanner.scanInbox();
  console.log('Conversations detected:', JSON.stringify(conversations, null, 2));
  process.exit(0);
}

testScan().catch(e => { console.error(e); process.exit(1); });
