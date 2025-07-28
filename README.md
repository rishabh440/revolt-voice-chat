# Talk to Rev - Revolt Motors Voice Chat

A real-time conversational voice interface using the Gemini Live API, replicating the functionality of the existing Revolt Motors chatbot with enhanced features.

## 🎯 Project Overview

This project demonstrates a complete implementation of a voice-based AI assistant using Google's Gemini Live API. The application provides natural conversation flow with real-time speech-to-text transcription, low-latency audio responses, and seamless interruption handling.

## ✨ Key Features

- **🎤 Real-time Voice Conversation**: Natural dialog with AI assistant "Rev"
- **✋ Interruption Support**: Users can interrupt AI mid-response 
- **⚡ Low Latency**: Optimized for 1-2 second response times
- **🔄 Speech-to-Text**: Shows user's actual words instead of generic placeholders
- **🎨 Clean UI**: Responsive design with audio visualization
- **🏍️ Revolt Motors Focus**: AI specifically trained on Revolt Motors information
- **🏗️ Server-to-Server Architecture**: Secure backend implementation

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- Modern web browser (Chrome recommended for best speech recognition)
- Gemini API key from [Google AI Studio](https://aistudio.google.com)

### Installation

1. **Clone the repository**:
   ```bash
   git clone [repository-url]
   cd revolt-voice
   npm install
   ```

2. **Get your Gemini API key**:
   - Visit [Google AI Studio](https://aistudio.google.com)
   - Create a free account and generate an API key
   - Copy the API key

3. **Configure environment**:
   ```bash
   # Edit .env file and add your API key:
   GEMINI_API_KEY=your_actual_api_key_here
   MODEL_NAME=gemini-2.0-flash-live-001
   PORT=3000
   ```

4. **Run the application**:
   ```bash
   npm run dev
   # Open http://localhost:3000
   ```

## 🎮 How to Use

1. **Launch**: Open http://localhost:3000 in your browser
2. **Permissions**: Allow microphone access when prompted
3. **Talk**: Click "Start Talking" and speak naturally
4. **Stop**: Click "Stop" when finished speaking
5. **Interrupt**: Click "Interrupt" while Rev is speaking to cut him off
6. **Conversation**: Your words appear as text, Rev responds with voice

## Model Options

The application supports multiple Gemini models:

- `gemini-2.5-flash-preview-native-audio-dialog` (Production - has rate limits)
- `gemini-2.0-flash-live-001` (Development - fewer limits)
- `gemini-live-2.5-flash-preview` (Alternative option)

Change the `MODEL_NAME` in your `.env` file to switch models.

## Technical Architecture

### Backend (server.js)
- **Express.js** server serving static files and WebSocket connections
- **WebSocket server** for real-time communication with frontend
- **Gemini Live API integration** via WebSocket connection
- **Audio format handling** (PCM 16-bit, 16kHz for input, 24kHz for output)

### Frontend (public/)
- **Vanilla JavaScript** for WebSocket communication and audio handling
- **Web Audio API** for audio processing and visualization
- **MediaRecorder API** for capturing user audio
- **Responsive CSS** with modern design

### Key Components

1. **Voice Recording**: Uses MediaRecorder to capture audio in WebM format
2. **Audio Processing**: Converts between different audio formats as needed
3. **Real-time Communication**: WebSocket connections for low-latency audio streaming
4. **Interruption Handling**: Sends interrupt signals to stop AI responses
5. **Audio Playback**: Decodes and plays AI responses using Web Audio API

## System Instructions

The AI assistant "Rev" is configured with specific instructions to:
- Only discuss Revolt Motors and electric vehicle topics
- Keep responses under 30 seconds for good conversation flow
- Maintain a helpful and conversational tone
- Redirect off-topic conversations back to Revolt Motors

## Troubleshooting

### Common Issues

1. **Microphone Access Denied**
   - Ensure you grant microphone permissions in your browser
   - Check browser settings for microphone access

2. **WebSocket Connection Failed**
   - Verify the server is running on the correct port
   - Check firewall settings

3. **Gemini API Errors**
   - Verify your API key is correct and active
   - Check if you've exceeded rate limits (switch to development model)
   - Ensure your Google AI Studio account is properly set up

4. **Audio Playback Issues**
   - Try refreshing the page to reinitialize audio context
   - Ensure your browser supports Web Audio API

5. **High Latency**
   - Use a stable internet connection
   - Consider switching to a different Gemini model
   - Check server resources and location

### Browser Compatibility

- Chrome 66+ (recommended)
- Firefox 60+
- Safari 14.1+
- Edge 79+

## Development

### Project Structure
```
revolt-voice/
├── server.js              # Express server and WebSocket handling
├── public/
│   ├── index.html         # Main HTML interface
│   ├── styles.css         # CSS styling
│   └── app.js            # Frontend JavaScript
├── package.json           # Dependencies and scripts
├── .env.example          # Environment variables template
└── README.md             # This file
```

### Adding Features

1. **Modify System Instructions**: Edit the `system_instruction` in `server.js`
2. **Update UI**: Modify files in the `public/` directory
3. **Add Audio Effects**: Extend the Web Audio API usage in `app.js`
4. **Enhance Error Handling**: Add more robust error handling in both frontend and backend

## Performance Optimization

- Audio is streamed in real-time for low latency
- WebSocket connections minimize HTTP overhead
- Audio visualization is optimized with requestAnimationFrame
- Efficient base64 encoding/decoding for audio data

## Security Considerations

- API keys are kept server-side only
- CORS is configured for development
- WebSocket connections are validated
- No sensitive data is logged or exposed

## Demo Video

Create a 30-60 second screen recording showing:
1. Natural conversation with Rev
2. Interruption functionality working correctly
3. Overall responsiveness and low latency

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License.
