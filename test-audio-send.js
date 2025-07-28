const WebSocket = require('ws');
require('dotenv').config();

async function testAudioSend() {
    console.log('Testing Gemini Live API with audio data...');
    
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
                        text: 'You are Rev from Revolt Motors. Keep responses very short.'
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
            console.log('📥 Received response keys:', Object.keys(response));
            
            if (response.setupComplete) {
                console.log('✅ Setup complete! Now sending test audio...');
                
                // Create a simple sine wave audio sample (1 second, 16kHz, 16-bit PCM)
                const sampleRate = 16000;
                const duration = 1; // 1 second
                const numSamples = sampleRate * duration;
                const frequency = 440; // A4 note
                
                const buffer = new ArrayBuffer(numSamples * 2); // 16-bit = 2 bytes per sample
                const view = new DataView(buffer);
                
                for (let i = 0; i < numSamples; i++) {
                    const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate);
                    const pcmValue = Math.round(sample * 32767);
                    view.setInt16(i * 2, pcmValue, true); // little-endian
                }
                
                const base64Audio = Buffer.from(buffer).toString('base64');
                
                // Try text first to see if basic messaging works
                const textMessage = {
                    clientContent: {
                        turns: [{
                            role: 'user',
                            parts: [{
                                text: 'Hello, can you hear me?'
                            }]
                        }],
                        turnComplete: true
                    }
                };
                
                console.log('📤 Sending text message first...');
                ws.send(JSON.stringify(textMessage));
                
                // Wait a bit then try audio
                setTimeout(() => {
                    const audioMessage = {
                        clientContent: {
                            turns: [{
                                role: 'user',
                                parts: [{
                                    inlineData: {
                                        mimeType: 'audio/pcm',
                                        data: base64Audio
                                    }
                                }]
                            }],
                            turnComplete: true
                        }
                    };
                    
                    console.log('📤 Now sending audio message...');
                    ws.send(JSON.stringify(audioMessage));
                }, 2000);
                
                console.log('📤 Sending audio message (sine wave test)...');
                ws.send(JSON.stringify(audioMessage));
                
                // Set timeout to see if we get a response
                setTimeout(() => {
                    console.log('⏰ No audio response after 10 seconds');
                    ws.close();
                    process.exit(1);
                }, 10000);
                
            } else if (response.serverContent) {
                console.log('🎵 Got server content!', Object.keys(response.serverContent));
                
                if (response.serverContent.modelTurn?.parts) {
                    const parts = response.serverContent.modelTurn.parts;
                    console.log('📝 Model turn parts:', parts.length);
                    
                    for (const part of parts) {
                        if (part.inlineData?.mimeType?.startsWith('audio/')) {
                            console.log('🔊 Got audio response! Length:', part.inlineData.data.length);
                        }
                        if (part.text) {
                            console.log('💬 Text response:', part.text);
                        }
                    }
                }
                
                if (response.serverContent.turnComplete) {
                    console.log('✅ Turn complete - Gemini responded successfully!');
                    ws.close();
                    process.exit(0);
                }
            }
        } catch (error) {
            console.error('❌ Error parsing response:', error);
        }
    });
    
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        process.exit(1);
    });
    
    ws.on('close', (code, reason) => {
        console.log('🔌 Connection closed:', code, reason.toString());
    });
}

testAudioSend().catch(console.error);