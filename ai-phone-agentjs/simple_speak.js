import Fastify from 'fastify';
import fastifyFormBody from '@fastify/formbody';
import dotenv from 'dotenv';
import { ElevenLabsClient } from 'elevenlabs';
import { WebSocketServer } from 'ws';

// Load keys
dotenv.config();
const { ELEVENLABS_API_KEY, PORT } = process.env;

// Initialize ElevenLabs
const elevenlabs = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY });

const fastify = Fastify();
fastify.register(fastifyFormBody);

// REPLACE WITH YOUR NGROK URL
const NGROK_URL = "aleen-hypoglycemic-palynologically.ngrok-free.dev";

fastify.get('/', async (request, reply) => {
    reply.send({ message: 'Simple Speak Server Running' });
});

fastify.all('/incoming-call', async (request, reply) => {
    const streamUrl = `wss://${NGROK_URL}/media-stream`;
    console.log(`📞 Incoming Call! Connecting to: ${streamUrl}`);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Connect>
            <Stream url="${streamUrl}" />
        </Connect>
    </Response>`;

    reply.type('text/xml').send(twiml);
});

const start = async () => {
    try {
        await fastify.listen({ port: PORT || 5050 });
        console.log(`Server listening on port ${PORT || 5050}`);

        const wss = new WebSocketServer({ server: fastify.server });

        wss.on('connection', (ws) => {
            console.log('✅ Client Connected!');

            ws.on('message', async (message) => {
                const data = JSON.parse(message.toString());

                if (data.event === 'start') {
                    const streamSid = data.start.streamSid;
                    console.log(`🚀 Stream Started! Speaking to SID: ${streamSid}`);

                    // CALL THE FUNCTION IMMEDIATELY
                    await speakTestPhrase(ws, streamSid);
                }
            });

            ws.on('close', () => console.log('❌ Disconnected'));
        });

    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

async function speakTestPhrase(ws, streamSid) {
    try {
        console.log("🔊 Requesting Audio from ElevenLabs...");

        // 1. Request the stream in specific Twilio format
        const audioStream = await elevenlabs.textToSpeech.convertAsStream(
            "JBFqnCBsd6RMkjVDRZzb",
            {
                text: "Hello! If you can hear this voice, the audio format is finally correct.",
                model_id: "eleven_turbo_v2",
                output_format: "ulaw_8000" // CRITICAL: Phone format
            }
        );

        console.log("🌊 Streaming Audio to Twilio...");

        let isFirstChunk = true;

        for await (const chunk of audioStream) {

            // 2. CRITICAL FIX: Strip the WAV Header (First 44 bytes)
            // Twilio will play STATIC if we don't remove this!
            let dataToSend = chunk;

            if (isFirstChunk) {
                isFirstChunk = false;
                if (chunk.length > 44) {
                    console.log("✂️ Stripping 44-byte WAV header from first chunk.");
                    dataToSend = chunk.subarray(44);
                }
            }

            const payload = dataToSend.toString('base64');

            const mediaMessage = {
                event: 'media',
                streamSid: streamSid,
                media: {
                    payload,
                    track: 'outbound' // CRITICAL: Must be "outbound"
                }
            };

            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify(mediaMessage));
            }
        }
        console.log(`✅ Finished sending audio.`);

    } catch (error) {
        console.error("❌ ELEVENLABS ERROR:", error.message);
    }
}

start();