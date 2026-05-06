const WebSocket = require('ws');

// Hardcode API key for testing
const API_KEY = 'b23e7156a3c149c89e9f86b8c11df8b4';

if (!API_KEY) {
  console.error('❌ ERROR: API key not set');
  process.exit(1);
}

// Test with 3 symbols
const SYMBOLS = ['BTC/USD', 'XAU/USD', 'EUR/USD']; // Testing EUR/USD instead of OIL

const url = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${API_KEY}`;

console.log('='.repeat(60));
console.log('TwelveData WebSocket Test');
console.log('='.repeat(60));
console.log(`Testing symbols: ${SYMBOLS.join(', ')}`);
console.log(`API Key: ${API_KEY.substring(0, 10)}...`);
console.log('='.repeat(60));

const ws = new WebSocket(url);

let messageCount = 0;
const receivedSymbols = new Set();

ws.on('open', () => {
  console.log('\n✅ WebSocket connected successfully');
  console.log(`⏰ Connected at: ${new Date().toISOString()}`);
  
  const subscribeMessage = {
    action: 'subscribe',
    params: { symbols: SYMBOLS.join(',') }
  };
  
  console.log('\n📤 Sending subscription request:');
  console.log(JSON.stringify(subscribeMessage, null, 2));
  
  ws.send(JSON.stringify(subscribeMessage));
  
  // Send heartbeat every 10 seconds
  setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'heartbeat' }));
      console.log('\n💓 Heartbeat sent');
    }
  }, 10000);
});

ws.on('message', (data) => {
  messageCount++;
  const message = JSON.parse(data.toString());
  
  console.log(`\n📨 Message #${messageCount} received at ${new Date().toISOString()}`);
  console.log(JSON.stringify(message, null, 2));
  
  if (message.event === 'subscribe-status') {
    console.log('\n📊 Subscription Status:');
    
    if (message.success && message.success.length > 0) {
      console.log('✅ Successfully subscribed to:');
      message.success.forEach(s => {
        const symbol = typeof s === 'string' ? s : s.symbol || JSON.stringify(s);
        console.log(`   - ${symbol}`);
      });
    }
    
    if (message.fails && message.fails.length > 0) {
      console.log('❌ Failed to subscribe to:');
      message.fails.forEach(f => {
        const symbol = typeof f === 'string' ? f : f.symbol || JSON.stringify(f);
        console.log(`   - ${symbol}`);
      });
    }
    
    console.log(`\n📈 Total subscribed: ${message.success?.length || 0}/${SYMBOLS.length}`);
  }
  
  if (message.event === 'price') {
    receivedSymbols.add(message.symbol);
    console.log(`\n💰 Price Update:`);
    console.log(`   Symbol: ${message.symbol}`);
    console.log(`   Price: ${message.price}`);
    console.log(`   Timestamp: ${message.timestamp || 'N/A'}`);
    console.log(`\n📊 Unique symbols received so far: ${Array.from(receivedSymbols).join(', ')}`);
  }
});

ws.on('error', (error) => {
  console.error('\n❌ WebSocket error:');
  console.error(error);
});

ws.on('close', (code, reason) => {
  console.log('\n🔌 WebSocket closed');
  console.log(`   Code: ${code}`);
  console.log(`   Reason: ${reason.toString() || 'No reason provided'}`);
  console.log(`   Total messages received: ${messageCount}`);
  console.log(`   Symbols that sent data: ${Array.from(receivedSymbols).join(', ') || 'None'}`);
  console.log('='.repeat(60));
});

// Keep the script running for 60 seconds to collect data
setTimeout(() => {
  console.log('\n⏱️  60 seconds elapsed. Closing connection...');
  console.log(`\n📊 Final Statistics:`);
  console.log(`   Total messages: ${messageCount}`);
  console.log(`   Symbols requested: ${SYMBOLS.join(', ')}`);
  console.log(`   Symbols received: ${Array.from(receivedSymbols).join(', ') || 'None'}`);
  console.log(`   Success rate: ${receivedSymbols.size}/${SYMBOLS.length} (${Math.round(receivedSymbols.size / SYMBOLS.length * 100)}%)`);
  
  ws.close();
  
  // Exit after 2 more seconds to allow close event to fire
  setTimeout(() => {
    process.exit(0);
  }, 2000);
}, 60000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Interrupted by user');
  ws.close();
  process.exit(0);
});
