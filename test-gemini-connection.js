const WebSocket = require('ws');
require('dotenv').config();

async function testGeminiConnection() {
    console.log('Testing Gemini Live API connection...');
    console.log('API Key:', process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.substring(0, 10)}...` : 'NOT FOUND');
    console.log('Model:', process.env.MODEL_NAME);
    
    const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const ws = new WebSocket(geminiUrl);
    
    ws.on('open', () => {
        console.log('✅ Connected to Gemini Live API');
        
        const setupMessage = {
            setup: {
                model: `models/${process.env.MODEL_NAME}`,
                generation_config: {
                    response_modalities: ['AUDIO'],
                    speech_config: {
                        voice_config: {
                            prebuilt_voice_config: {
                                voice_name: 'Puck'
                            }
                        }
                    }
                },
                system_instruction: {
                    parts: [{
                        text: 'You are a helpful assistant. Please respond briefly.'
                    }]
                }
            }
        };
        
        console.log('📤 Sending setup message...');
        ws.send(JSON.stringify(setupMessage));
    });
    
    ws.on('message', (data) => {
        try {
            const response = JSON.parse(data);
            console.log('📥 Received response:', JSON.stringify(response, null, 2));
            
            if (response.setupComplete) {
                console.log('✅ Setup complete! Gemini Live API is working.');
                ws.close();
                process.exit(0);
            }
        } catch (error) {
            console.error('❌ Error parsing response:', error);
        }
    });
    
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
        if (error.message.includes('401')) {
            console.error('🔑 API Key issue - check your GEMINI_API_KEY in .env file');
        } else if (error.message.includes('429')) {
            console.error('⚠️ Rate limit exceeded - try again later or use a different model');
        }
        process.exit(1);
    });
    
    ws.on('close', (code, reason) => {
        console.log('🔌 Connection closed:', code, reason.toString());
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
        console.error('⏰ Connection test timed out after 10 seconds');
        ws.close();
        process.exit(1);
    }, 10000);
}

testGeminiConnection().catch(console.error);