import Fastify from 'fastify';
import fastifyFormBody from '@fastify/formbody';
import dotenv from 'dotenv';
import axios from 'axios'; // We use this for raw stream control
import { WebSocketServer } from 'ws';

dotenv.config();
const { ELEVENLABS_API_KEY, PORT } = process.env;

const fastify = Fastify();
fastify.register(fastifyFormBody);

// REPLACE WITH YOUR NGROK URL
const NGROK_URL = "aleen-hypoglycemic-palynologically.ngrok-free.dev"; 

fastify.get('/', async (request, reply) => {
    reply.send({ message: 'Manual Stream Server Running' });
});

fastify.all('/incoming-call', async (request, reply) => {
    const streamUrl = `wss://${NGROK_URL}/media-stream`;
    console.log(`📞 Incoming Call! Connecting to: ${streamUrl}`);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say>Manual stream test. Listen closely.</Say>
        <Connect>
            <Stream url="${streamUrl}" />
        </Connect>
    </Response>`;

    reply.type('text/xml').send(twiml);
});

const start = async () => {
    try {
        await fastify.listen({ port: PORT || 5000 });
        console.log(`Server listening on port ${PORT || 5000}`);

        const wss = new WebSocketServer({ server: fastify.server });

        wss.on('connection', (ws) => {
            console.log('✅ Client Connected!');

            ws.on('message', async (message) => {
                const data = JSON.parse(message.toString());

                if (data.event === 'start') {
                    const streamSid = data.start.streamSid;
                    console.log(`🚀 Stream Started! SID: ${streamSid}`);
                    // Trigger the manual stream
                    streamRawAudio(ws, streamSid);
                } 
            });

            ws.on('close', () => console.log('❌ Disconnected'));
        });

    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

async function streamRawAudio(ws, streamSid) {
    try {
        console.log("🔊 Fetching Raw Audio via Axios...");

        // 1. Direct API Call (Bypassing SDK for granular control)
        const voiceId = "JBFqnCBsd6RMkjVDRZzb";
        const model = "eleven_turbo_v2";
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=ulaw_8000`;

        const response = await axios({
            method: 'post',
            url: url,
            headers: { 
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            },
            data: {
                text: "Hello! This is a direct raw audio stream. If you hear this, the fix worked.",
                model_id: model
            },
            responseType: 'stream' // CRITICAL: Get data as a stream
        });

        console.log("🌊 Streaming Raw Data to Twilio...");
        
        const stream = response.data;
        let isFirstChunk = true;

        stream.on('data', (chunk) => {
            let dataToSend = chunk;

            // 2. HEADER DETECTION & STRIPPING
            if (isFirstChunk) {
                isFirstChunk = false;
                // Check for 'RIFF' (WAV Header)
                if (chunk.length >= 4 && chunk[0] === 0x52 && chunk[1] === 0x49 && chunk[2] === 0x46 && chunk[3] === 0x46) {
                    console.log("⚠️ WAV Header Detected! Stripping first 44 bytes...");
                    dataToSend = chunk.subarray(44);
                }
            }

            // 3. Send to Twilio
            const payload = dataToSend.toString('base64');
            const mediaMessage = {
                event: 'media',
                streamSid: streamSid,
                media: { 
                    payload,
                    track: 'outbound'
                }
            };

            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify(mediaMessage));
            }
        });

        stream.on('end', () => console.log("✅ Stream Finished."));

    } catch (error) {
        console.error("❌ AXIOS ERROR:", error.message);
    }
}

start();