const instagramScanner = require('../src/instagram/instagram-scanner');

async function testRead() {
  const res = await instagramScanner.openThreadAndReadMessages('17842356972644031');
  console.log('Result:', JSON.stringify(res, null, 2));
  process.exit(0);
}

testRead().catch(e => { console.error(e); process.exit(1); });
