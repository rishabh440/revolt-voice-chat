const WebSocket = require('ws');

// Simple test to verify server can start and handle basic WebSocket connections
function testServer() {
    const server = require('./server.js');
    
    // Test WebSocket connection
    setTimeout(() => {
        const ws = new WebSocket('ws://localhost:3000');
        
        ws.on('open', () => {
            console.log('✅ WebSocket connection successful');
            
            // Test basic message handling
            ws.send(JSON.stringify({ type: 'start_session' }));
            
            setTimeout(() => {
                ws.close();
                console.log('✅ Basic server test passed');
                process.exit(0);
            }, 1000);
        });
        
        ws.on('error', (error) => {
            console.error('❌ WebSocket connection failed:', error);
            process.exit(1);
        });
        
    }, 2000);
}

// Run test if this file is executed directly
if (require.main === module) {
    console.log('🧪 Testing server functionality...');
    testServer();
}