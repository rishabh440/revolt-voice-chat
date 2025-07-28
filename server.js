const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  let geminiWs = null;
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received message type:', data.type);
      
      if (data.type === 'start_session') {
        console.log('Starting new Gemini Live session');
        geminiWs = await startGeminiLiveSession(ws);
      } else if (data.type === 'audio_data' && geminiWs) {
        console.log('Processing audio data, length:', data.audio ? data.audio.length : 'undefined');
        
        if (geminiWs.readyState !== WebSocket.OPEN) {
          console.error('Gemini WebSocket not open, state:', geminiWs.readyState);
          ws.send(JSON.stringify({ type: 'error', message: 'Gemini connection not ready' }));
          return;
        }
        
        // Send audio in the correct format for Gemini Live API
        const audioMessage = {
          clientContent: {
            turns: [{
              role: 'user',
              parts: [{
                inlineData: {
                  mimeType: 'audio/wav',
                  data: data.audio
                }
              }]
            }],
            turnComplete: true
          }
        };
        
        console.log('Sending audio to Gemini Live API, WebSocket state:', geminiWs.readyState);
        console.log('Audio message preview:', JSON.stringify({
          ...audioMessage,
          clientContent: {
            ...audioMessage.clientContent,
            turns: audioMessage.clientContent.turns.map(turn => ({
              ...turn,
              parts: turn.parts.map(part => ({
                ...part,
                inlineData: {
                  ...part.inlineData,
                  data: `[${part.inlineData.data.length} bytes]`
                }
              }))
            }))
          }
        }, null, 2));
        
        try {
          geminiWs.send(JSON.stringify(audioMessage));
          console.log('Audio message sent successfully to Gemini');
          
          // Set a timeout to detect if Gemini doesn't respond
          setTimeout(() => {
            console.warn('No response from Gemini after 8 seconds - this might indicate an issue');
          }, 8000);
          
        } catch (sendError) {
          console.error('Error sending to Gemini:', sendError);
          ws.send(JSON.stringify({ type: 'error', message: 'Failed to send audio to Gemini' }));
        }
        
      } else if (data.type === 'interrupt' && geminiWs) {
        console.log('Sending interrupt signal');
        geminiWs.send(JSON.stringify({
          clientContent: {
            turns: [],
            turnComplete: false
          }
        }));
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
    if (geminiWs) {
      geminiWs.close();
    }
  });
});

async function startGeminiLiveSession(clientWs) {
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY not found in environment variables');
    clientWs.send(JSON.stringify({ type: 'error', message: 'API key not configured' }));
    return null;
  }
  
  const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${process.env.GEMINI_API_KEY}`;
  console.log('Connecting to Gemini Live API...');
  
  const geminiWs = new WebSocket(geminiUrl);
  
  geminiWs.on('open', () => {
    console.log('Connected to Gemini Live API');
    
    const setupMessage = {
      setup: {
        model: `models/${process.env.MODEL_NAME || 'gemini-2.0-flash-live-001'}`,
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
            text: `You are Rev, the voice assistant for Revolt Motors. Revolt Motors is an Indian electric motorcycle company that manufactures premium electric motorcycles.

Key information about Revolt Motors:
- Founded in India by Rahul Sharma, focuses on electric motorcycles
- Known for premium electric bikes like RV400 and RV1+ with modern technology
- Committed to sustainable transportation solutions
- Offers smart connectivity features, mobile app integration
- Has MyRevolt subscription plans and charging solutions
- Focuses on performance, style, and eco-friendly transportation

Only discuss topics related to Revolt Motors, their products, electric vehicles, and related automotive topics. Keep responses conversational, helpful, and under 20 seconds. If asked about unrelated topics, politely redirect to Revolt Motors.

Speak naturally and be enthusiastic about Revolt's electric motorcycle innovations.`
          }]
        }
      }
    };
    
    console.log('Sending setup message to Gemini:', JSON.stringify(setupMessage, null, 2));
    geminiWs.send(JSON.stringify(setupMessage));
  });
  
  geminiWs.on('message', (data) => {
    try {
      const response = JSON.parse(data);
      console.log('Gemini response received:', JSON.stringify(response, null, 2));
      
      if (response.setupComplete) {
        console.log('Gemini Live session setup complete');
        clientWs.send(JSON.stringify({ type: 'session_ready' }));
        return;
      }
      
      if (response.serverContent) {
        console.log('Server content received:', Object.keys(response.serverContent));
        
        if (response.serverContent.modelTurn?.parts) {
          const parts = response.serverContent.modelTurn.parts;
          console.log('Model turn parts:', parts.length);
          
          for (const part of parts) {
            if (part.inlineData?.mimeType?.startsWith('audio/')) {
              console.log('Sending audio response to client');
              clientWs.send(JSON.stringify({
                type: 'audio_response',
                audio: part.inlineData.data
              }));
            }
            if (part.text) {
              console.log('Text response:', part.text);
            }
          }
        }
        
        if (response.serverContent.turnComplete) {
          console.log('Turn complete');
          clientWs.send(JSON.stringify({
            type: 'turn_complete'
          }));
        }
      }
      
      // Handle errors from Gemini
      if (response.error) {
        console.error('Gemini API error:', JSON.stringify(response.error, null, 2));
        clientWs.send(JSON.stringify({ 
          type: 'error', 
          message: 'Gemini API error: ' + (response.error.message || JSON.stringify(response.error))
        }));
      }
      
      // Log any unexpected response structure
      if (!response.setupComplete && !response.serverContent && !response.error) {
        console.warn('Unexpected Gemini response structure:', Object.keys(response));
      }
      
    } catch (error) {
      console.error('Error processing Gemini response:', error);
      clientWs.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });
  
  geminiWs.on('error', (error) => {
    console.error('Gemini WebSocket error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      type: error.type
    });
    clientWs.send(JSON.stringify({ 
      type: 'error', 
      message: `Gemini connection error: ${error.message}` 
    }));
  });
  
  geminiWs.on('close', (code, reason) => {
    console.log('Gemini WebSocket connection closed');
    console.log('Close code:', code);
    console.log('Close reason:', reason.toString());
    
    // Log common close codes
    const closeCodes = {
      1000: 'Normal closure',
      1001: 'Going away',
      1002: 'Protocol error',
      1003: 'Unsupported data',
      1005: 'No status received',
      1006: 'Abnormal closure',
      1007: 'Invalid frame payload data',
      1008: 'Policy violation',
      1009: 'Message too big',
      1010: 'Mandatory extension',
      1011: 'Internal server error',
      1015: 'TLS handshake'
    };
    
    if (closeCodes[code]) {
      console.log('Close code meaning:', closeCodes[code]);
    }
    
    // Notify client about the disconnection
    if (clientWs && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'error',
        message: `Gemini connection closed: ${closeCodes[code] || 'Unknown'} (${code})`
      }));
    }
  });
  
  return geminiWs;
}

// Audio conversion utilities (removed as not needed)
// Gemini Live API can handle WebM/Opus directly

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});