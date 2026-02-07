import Fastify from 'fastify';
import fastifyFormBody from '@fastify/formbody';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios'; 
import { WebSocketServer } from 'ws';

dotenv.config();
const { GOOGLE_API_KEY, ELEVENLABS_API_KEY, PORT } = process.env;

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json" }
}); 

const fastify = Fastify();
fastify.register(fastifyFormBody);

const NGROK_URL = "aleen-hypoglycemic-palynologically.ngrok-free.dev"; 

// SESSION TRACKING
let conversationLog = "";
let callEnded = false;

fastify.all('/incoming-call', async (request, reply) => {
    conversationLog = "";
    callEnded = false;
    const streamUrl = `wss://${NGROK_URL}/media-stream`;
    console.log(`📞 New Call! Connecting to: ${streamUrl}`);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say>911 emergency. What is the location of your emergency?</Say>
        <Connect><Stream url="${streamUrl}" /></Connect>
    </Response>`;
    reply.type('text/xml').send(twiml);
});

const start = async () => {
    try {
        const port = PORT || 5050; 
        await fastify.listen({ port: port, host: '0.0.0.0' });
        console.log(`🚀 Server listening on port ${port}`);

        const wss = new WebSocketServer({ server: fastify.server });

        wss.on('connection', (ws) => {
            console.log('✅ Twilio Stream Connected');
            let streamSid = null;
            let audioBuffer = [];
            let silentChunks = 0;
            let isProcessing = false;

            const SILENCE_THRESHOLD = 200;
            const SILENCE_DURATION = 250; // 5 Seconds

            ws.on('message', async (message) => {
                if (callEnded) return; 
                try {
                    const data = JSON.parse(message.toString());
                    if (data.event === 'start') {
                        streamSid = data.start.streamSid;
                    } else if (data.event === 'media') {
                        if (isProcessing) return;
                        const chunk = Buffer.from(data.media.payload, 'base64');
                        audioBuffer.push(chunk);

                        // Prevent 429: Keep buffer lean
                        if (audioBuffer.length > 300) audioBuffer.shift(); 

                        const energy = chunk.reduce((acc, byte) => acc + Math.abs(byte - 128), 0) / chunk.length;
                        if (energy > SILENCE_THRESHOLD) {
                            silentChunks = 0; 
                        } else {
                            silentChunks++;   
                        }

                        if (silentChunks > SILENCE_DURATION && audioBuffer.length > 20) {
                            console.log('🗣️ User silence detected. Processing turn...');
                            isProcessing = true;
                            const completeAudio = Buffer.concat(audioBuffer);
                            audioBuffer = [];
                            silentChunks = 0;
                            
                            await processAudio(completeAudio, ws, streamSid);
                            isProcessing = false;
                        }
                    }
                } catch (error) { console.error('❌ WS Message Error:', error); }
            });
        });
    } catch (err) {
        console.error("❌ Failed to start server:", err);
        process.exit(1);
    }
};

async function generateWithRetry(content, retries = 3, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try { return await model.generateContent(content); } 
        catch (error) {
            if (error.message.includes("429") && i < retries - 1) {
                console.log(`⚠️ Rate limit hit. Retrying in ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
                delay *= 2;
            } else throw error;
        }
    }
}

async function processAudio(audioData, ws, streamSid) {
    try {
        const wavHeader = createWavHeader(audioData.length);
        const wavBuffer = Buffer.concat([wavHeader, audioData]);
        const base64Audio = wavBuffer.toString('base64');

        const systemPrompt = `
            You are a 911 Emergency Dispatcher.
            Current Conversation History:
            ${conversationLog}

            GOAL: You must collect exactly three things:
            1. The Address/Location.
            2. The Nature of the emergency (e.g., fire, medical, police).
            3. Brief descriptive info/details about the emergency.

            INSTRUCTIONS:
            - If you are missing any of those 3, ask a SHORT follow-up question.
            - If you have successfully received all 3, tell the user help is on the way and to stay on the line.
            
            MANDATORY JSON OUTPUT:
            {
              "transcript": "what the user just said",
              "reply": "your response",
              "allInfoCollected": true/false
            }
        `;

        const result = await generateWithRetry([
            { text: systemPrompt },
            { inlineData: { mimeType: "audio/wav", data: base64Audio } }
        ]);

        const responseJson = JSON.parse(result.response.text().replace(/```json|```/g, "").trim());
        console.log(`🎤 CALLER: ${responseJson.transcript}`);
        console.log(`🤖 AGENT: ${responseJson.reply}`);
        
        conversationLog += `\nUser: ${responseJson.transcript}\nAgent: ${responseJson.reply}`;

        const response = await axios({
            method: 'post',
            url: `https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb/stream?output_format=ulaw_8000`,
            headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
            data: { text: responseJson.reply, model_id: "eleven_turbo_v2" },
            responseType: 'stream'
        });

        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ event: 'clear', streamSid }));

        let isFirstChunk = true;
        response.data.on('data', (chunk) => {
            let dataToSend = chunk;
            if (isFirstChunk && chunk.length >= 44 && chunk[0] === 0x52) {
                isFirstChunk = false;
                dataToSend = chunk.subarray(44);
            }
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ event: 'media', streamSid, media: { payload: dataToSend.toString('base64'), track: 'outbound' } }));
            }
        });

        if (responseJson.allInfoCollected === true) {
            console.log("🏁 All emergency information gathered. Dispatching.");
            callEnded = true;
        }

    } catch (error) { console.error("❌ AI Pipeline Error:", error.message); }
}

function createWavHeader(dataLength) {
    const buffer = Buffer.alloc(44);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataLength, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(7, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(8000, 24);
    buffer.writeUInt32LE(8000, 28);
    buffer.writeUInt16LE(1, 32);
    buffer.writeUInt16LE(8, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataLength, 40);
    return buffer;
}

start();