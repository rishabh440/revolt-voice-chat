class VoiceChat {
    constructor() {
        this.ws = null;
        this.mediaRecorder = null;
        this.audioStream = null;
        this.audioContext = null;
        this.audioQueue = [];
        this.isPlaying = false;
        this.isRecording = false;
        this.currentAudio = null;
        this.audioSource = null;
        this.audioChunks = [];
        this.responseTimeout = null;
        this.recognition = null;
        this.pendingUserMessage = false;
        this.lastTranscription = '';
        
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.interruptBtn = document.getElementById('interruptBtn');
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        this.conversationLog = document.getElementById('conversationLog');
        this.visualizer = document.getElementById('visualizer');
        
        this.setupEventListeners();
        this.initializeAudioContext();
        this.connect();
    }
    
    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startRecording());
        this.stopBtn.addEventListener('click', () => this.stopRecording());
        this.interruptBtn.addEventListener('click', () => this.interrupt());
    }
    
    async initializeAudioContext() {
        try {
            const AudioContextClass = window.AudioContext || window['webkitAudioContext'];
            this.audioContext = new AudioContextClass({
                sampleRate: 16000
            });
            
            // Initialize speech recognition
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                this.recognition = new SpeechRecognition();
                this.recognition.continuous = false;
                this.recognition.interimResults = false;
                this.recognition.lang = 'en-US';
                
                this.recognition.onresult = (event) => {
                    if (event.results.length > 0) {
                        this.lastTranscription = event.results[0][0].transcript;
                        console.log('Transcription:', this.lastTranscription);
                    }
                };
                
                this.recognition.onerror = (event) => {
                    console.error('Speech recognition error:', event.error);
                };
                
                console.log('Speech recognition initialized');
            } else {
                console.warn('Speech recognition not supported in this browser');
            }
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
            alert('Audio not supported in this browser. Please try Chrome, Firefox, or Safari.');
        }
    }
    
    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('Connected to server');
            this.updateStatus('connecting', 'Initializing Rev...');
            
            // Give a small delay then start session
            setTimeout(() => {
                console.log('Starting Gemini Live session...');
                this.ws.send(JSON.stringify({ type: 'start_session' }));
            }, 500);
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleServerMessage(data);
        };
        
        this.ws.onclose = () => {
            console.log('Disconnected from server');
            this.updateStatus('disconnected', 'Disconnected - Reconnecting...');
            // Attempt to reconnect after 3 seconds
            setTimeout(() => {
                if (this.ws.readyState === WebSocket.CLOSED) {
                    this.connect();
                }
            }, 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateStatus('error', 'Connection error');
        };
    }
    
    async handleServerMessage(data) {
        console.log('Received server message:', data.type);
        
        switch (data.type) {
            case 'session_ready':
                console.log('Gemini Live session is ready');
                this.updateStatus('connected', 'Ready to talk');
                break;
            case 'audio_response':
                console.log('Audio chunk received, length:', data.audio.length);
                // Clear timeout on first audio chunk
                if (this.responseTimeout) {
                    clearTimeout(this.responseTimeout);
                    this.responseTimeout = null;
                }
                
                // Add user message with transcription if we haven't yet
                if (this.pendingUserMessage) {
                    const userText = this.lastTranscription || '[Voice message]';
                    this.addMessage('You', userText, 'user-message');
                    this.pendingUserMessage = false;
                }
                
                // Collect audio chunks
                this.audioChunks.push(data.audio);
                if (!this.isPlaying) {
                    this.updateStatus('speaking', 'Rev is responding...');
                }
                break;
            case 'turn_complete':
                console.log('Turn complete - combining and playing', this.audioChunks.length, 'audio chunks');
                if (this.audioChunks.length > 0) {
                    await this.playAudioChunks(this.audioChunks);
                    this.audioChunks = []; // Clear chunks
                }
                this.updateStatus('connected', 'Ready to listen');
                break;
            case 'error':
                console.error('Server error:', data.message);
                this.addMessage('Rev', `Error: ${data.message}`, 'bot-message');
                this.updateStatus('error', 'Error occurred');
                // Clear timeout on error
                if (this.responseTimeout) {
                    clearTimeout(this.responseTimeout);
                    this.responseTimeout = null;
                }
                break;
        }
    }
    
    async playAudioChunks(audioChunks) {
        try {
            console.log('Combining', audioChunks.length, 'audio chunks for playback');
            
            // Combine all audio chunks into one buffer
            let totalSize = 0;
            const decodedChunks = [];
            
            for (const chunk of audioChunks) {
                const chunkData = this.base64ToArrayBuffer(chunk);
                decodedChunks.push(chunkData);
                totalSize += chunkData.byteLength;
            }
            
            console.log('Total combined audio size:', totalSize, 'bytes');
            
            // Create combined buffer
            const combinedBuffer = new ArrayBuffer(totalSize);
            const combinedView = new Uint8Array(combinedBuffer);
            let offset = 0;
            
            for (const chunkData of decodedChunks) {
                const chunkView = new Uint8Array(chunkData);
                combinedView.set(chunkView, offset);
                offset += chunkData.byteLength;
            }
            
            // Play the combined audio
            await this.playAudio(combinedBuffer);
            
        } catch (error) {
            console.error('Error combining audio chunks:', error);
            this.isPlaying = false;
            this.interruptBtn.disabled = true;
        }
    }
    
    async playAudio(audioData) {
        try {
            this.isPlaying = true;
            this.updateStatus('speaking', 'Rev is speaking...');
            this.interruptBtn.disabled = false;
            
            // audioData is already an ArrayBuffer from playAudioChunks or base64 string from direct calls
            const pcmData = audioData instanceof ArrayBuffer ? audioData : this.base64ToArrayBuffer(audioData);
            
            try {
                // Create AudioBuffer from PCM data (24kHz, 16-bit, mono)
                const sampleRate = 24000; // Gemini outputs at 24kHz
                const numSamples = pcmData.byteLength / 2; // 16-bit = 2 bytes per sample
                
                if (this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                }
                
                const audioBuffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
                const channelData = audioBuffer.getChannelData(0);
                
                // Convert 16-bit PCM to float
                const dataView = new DataView(pcmData);
                for (let i = 0; i < numSamples; i++) {
                    const sample = dataView.getInt16(i * 2, true); // little-endian
                    channelData[i] = sample / 32768.0; // Convert to [-1, 1] range
                }
                
                this.audioSource = this.audioContext.createBufferSource();
                this.audioSource.buffer = audioBuffer;
                this.audioSource.connect(this.audioContext.destination);
                
                this.audioSource.onended = () => {
                    this.isPlaying = false;
                    this.interruptBtn.disabled = true;
                    this.audioSource = null;
                };
                
                this.audioSource.start();
                
            } catch (decodeError) {
                console.error('PCM audio playback failed:', decodeError);
                this.isPlaying = false;
                this.interruptBtn.disabled = true;
            }
            
        } catch (error) {
            console.error('Error playing audio:', error);
            this.isPlaying = false;
            this.interruptBtn.disabled = true;
        }
    }
    
    base64ToArrayBuffer(base64) {
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }
    
    async startRecording() {
        try {
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            this.audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            
            // Try different audio formats based on browser support
            let mimeType = 'audio/webm;codecs=opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'audio/webm';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = 'audio/mp4';
                }
            }
            
            this.mediaRecorder = new MediaRecorder(this.audioStream, {
                mimeType: mimeType
            });
            
            const audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = async () => {
                console.log('Recording stopped, processing audio...');
                this.updateStatus('connected', 'Converting audio format...');
                
                const audioBlob = new Blob(audioChunks, { type: mimeType });
                
                try {
                    // Convert WebM to PCM 16kHz for Gemini Live API
                    const pcmData = await this.convertToPCM(audioBlob);
                    console.log('Audio converted to PCM, size:', pcmData.length);
                    
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        console.log('Sending PCM audio to server...');
                        this.ws.send(JSON.stringify({
                            type: 'audio_data',
                            audio: pcmData
                        }));
                        
                        this.updateStatus('connected', 'Transcribing and sending...');
                        // We'll update this with transcription later
                        this.pendingUserMessage = true;
                        
                        // Add timeout in case Gemini doesn't respond
                        this.responseTimeout = setTimeout(() => {
                            if (this.isPlaying === false) {
                                console.warn('No response from Gemini after 10 seconds');
                                this.updateStatus('connected', 'No response - try again');
                                this.addMessage('Rev', 'Sorry, I didn\'t get that. Please try speaking again.', 'bot-message');
                            }
                        }, 10000);
                    } else {
                        console.error('WebSocket not connected');
                        this.updateStatus('error', 'Connection lost');
                    }
                } catch (error) {
                    console.error('Error converting audio:', error);
                    this.updateStatus('error', 'Audio conversion failed');
                    this.addMessage('Rev', 'Sorry, there was an issue processing your audio. Please try again.', 'bot-message');
                }
            };
            
            this.mediaRecorder.start(1000);
            this.isRecording = true;
            this.lastTranscription = '';
            
            // Start speech recognition for transcription
            if (this.recognition) {
                try {
                    this.recognition.start();
                    console.log('Started speech recognition');
                } catch (error) {
                    console.warn('Could not start speech recognition:', error);
                }
            }
            
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.updateStatus('listening', 'Listening...');
            
            this.startVisualization();
            
        } catch (error) {
            console.error('Error starting recording:', error);
            alert('Could not access microphone. Please check permissions.');
        }
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            
            // Stop speech recognition
            if (this.recognition) {
                try {
                    this.recognition.stop();
                    console.log('Stopped speech recognition');
                } catch (error) {
                    console.warn('Error stopping speech recognition:', error);
                }
            }
            
            if (this.audioStream) {
                this.audioStream.getTracks().forEach(track => track.stop());
            }
            
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
            this.updateStatus('connected', 'Processing...');
            
            this.stopVisualization();
        }
    }
    
    interrupt() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'interrupt' }));
            
            // Stop current audio playback immediately
            if (this.currentAudio) {
                this.currentAudio.pause();
                this.currentAudio.currentTime = 0;
                this.currentAudio = null;
            }
            
            if (this.audioSource) {
                this.audioSource.stop();
                this.audioSource = null;
            }
            
            // Clear audio queue
            this.audioQueue = [];
            
            this.updateStatus('connected', 'Interrupted - Ready to listen');
            this.interruptBtn.disabled = true;
            this.isPlaying = false;
            
            this.addMessage('You', '[Interrupted Rev]', 'user-message');
            
            // Auto-start recording after interruption
            setTimeout(() => {
                if (!this.isRecording && !this.isPlaying) {
                    this.startRecording();
                }
            }, 500);
        }
    }
    
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }
    
    updateStatus(status, text) {
        this.statusDot.className = `status-dot ${status}`;
        this.statusText.textContent = text;
    }
    
    addMessage(speaker, text, className) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${className}`;
        messageDiv.innerHTML = `
            <span class="speaker">${speaker}:</span>
            <span class="text">${text}</span>
        `;
        
        this.conversationLog.appendChild(messageDiv);
        this.conversationLog.scrollTop = this.conversationLog.scrollHeight;
    }
    
    startVisualization() {
        if (!this.audioStream) return;
        
        const canvas = this.visualizer;
        const ctx = canvas.getContext('2d');
        const analyser = this.audioContext.createAnalyser();
        const source = this.audioContext.createMediaStreamSource(this.audioStream);
        
        source.connect(analyser);
        analyser.fftSize = 256;
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const draw = () => {
            if (!this.isRecording) return;
            
            requestAnimationFrame(draw);
            
            analyser.getByteFrequencyData(dataArray);
            
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
                
                const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
                gradient.addColorStop(0, '#667eea');
                gradient.addColorStop(1, '#764ba2');
                
                ctx.fillStyle = gradient;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                
                x += barWidth + 1;
            }
        };
        
        draw();
    }
    
    stopVisualization() {
        const canvas = this.visualizer;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    async convertToPCM(audioBlob) {
        try {
            console.log('Converting audio blob to PCM, size:', audioBlob.size, 'type:', audioBlob.type);
            
            // Decode the WebM audio using Web Audio API
            const arrayBuffer = await audioBlob.arrayBuffer();
            console.log('ArrayBuffer size:', arrayBuffer.byteLength);
            
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            console.log('Decoded audio - Sample rate:', audioBuffer.sampleRate, 'Length:', audioBuffer.length, 'Duration:', audioBuffer.duration);
            
            // Resample to 16kHz and convert to 16-bit PCM
            const targetSampleRate = 16000;
            
            // If already at 16kHz, use directly, otherwise resample
            let audioData;
            if (Math.abs(audioBuffer.sampleRate - targetSampleRate) < 100) {
                console.log('Using original sample rate (close to 16kHz)');
                audioData = audioBuffer.getChannelData(0);
            } else {
                console.log('Resampling from', audioBuffer.sampleRate, 'to', targetSampleRate);
                // Simple resampling
                const ratio = audioBuffer.sampleRate / targetSampleRate;
                const newLength = Math.round(audioBuffer.length / ratio);
                audioData = new Float32Array(newLength);
                
                const sourceData = audioBuffer.getChannelData(0);
                for (let i = 0; i < newLength; i++) {
                    const sourceIndex = Math.round(i * ratio);
                    audioData[i] = sourceData[sourceIndex] || 0;
                }
            }
            
            console.log('Final audio data length:', audioData.length, 'samples');
            
            // Convert float samples to 16-bit PCM
            const pcmBuffer = new ArrayBuffer(audioData.length * 2);
            const pcmView = new DataView(pcmBuffer);
            
            for (let i = 0; i < audioData.length; i++) {
                const sample = Math.max(-1, Math.min(1, audioData[i]));
                const pcmValue = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                pcmView.setInt16(i * 2, pcmValue, true); // little-endian
            }
            
            console.log('PCM buffer size:', pcmBuffer.byteLength, 'bytes');
            
            // Create WAV file with headers
            const wavBuffer = this.createWAVFile(pcmBuffer, targetSampleRate);
            console.log('WAV file size:', wavBuffer.byteLength, 'bytes');
            
            // Convert to base64
            const base64 = this.arrayBufferToBase64(wavBuffer);
            console.log('Base64 WAV size:', base64.length, 'characters');
            
            return base64;
            
        } catch (error) {
            console.error('PCM conversion failed:', error);
            // Create a simple silence audio as fallback
            console.log('Creating fallback silence WAV audio');
            const silenceBuffer = new ArrayBuffer(16000 * 2); // 1 second of silence at 16kHz
            const silenceView = new DataView(silenceBuffer);
            for (let i = 0; i < 16000; i++) {
                silenceView.setInt16(i * 2, 0, true); // silence
            }
            const wavBuffer = this.createWAVFile(silenceBuffer, 16000);
            return this.arrayBufferToBase64(wavBuffer);
        }
    }
    
    createWAVFile(pcmData, sampleRate) {
        const pcmLength = pcmData.byteLength;
        const buffer = new ArrayBuffer(44 + pcmLength);
        const view = new DataView(buffer);
        
        // WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        // RIFF header
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + pcmLength, true); // file size - 8
        writeString(8, 'WAVE');
        
        // fmt chunk
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true); // chunk size
        view.setUint16(20, 1, true); // PCM format
        view.setUint16(22, 1, true); // mono
        view.setUint32(24, sampleRate, true); // sample rate
        view.setUint32(28, sampleRate * 2, true); // byte rate
        view.setUint16(32, 2, true); // block align
        view.setUint16(34, 16, true); // bits per sample
        
        // data chunk
        writeString(36, 'data');
        view.setUint32(40, pcmLength, true); // data size
        
        // Copy PCM data
        const pcmView = new Uint8Array(pcmData);
        const wavView = new Uint8Array(buffer);
        wavView.set(pcmView, 44);
        
        return buffer;
    }
    
}

document.addEventListener('DOMContentLoaded', () => {
    new VoiceChat();
});