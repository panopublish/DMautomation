const instagramScanner = require('../src/instagram/instagram-scanner');

async function testReadThread() {
  const result = await instagramScanner.openThreadAndReadMessages('17842356972644031');
  console.log('Thread scan result:');
  console.log('Handle:', result.handle);
  console.log('Messages count:', result.messages.length);
  console.log('Messages sample:', JSON.stringify(result.messages.slice(-3), null, 2));
  process.exit(0);
}

testReadThread().catch(e => { console.error(e); process.exit(1); });
