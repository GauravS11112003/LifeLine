import Fastify from 'fastify';
import fastifyFormBody from '@fastify/formbody';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { WebSocketServer } from 'ws';
import Sentiment from 'sentiment';
import { initCall, setStreamSid, saveMessage, updateCallSummary, endCall } from './firebase.js';

// Load keys
dotenv.config();
const sentiment = new Sentiment();
const { GOOGLE_API_KEY, ELEVENLABS_API_KEY, PORT } = process.env;

// Initialize Gemini
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json" }
}); 

// Initialize Fastify
const fastify = Fastify();
fastify.register(fastifyFormBody);

// If Twilio gets 403 on the webhook, ngrok free tier may block non-browser requests;
// use a paid tunnel or host (e.g. Railway, Render) for production.
// Use PUBLIC_DOMAIN or NGROK_URL from .env (hostname only, no https://)
const NGROK_URL = (process.env.PUBLIC_DOMAIN || process.env.NGROK_URL || "regionalistic-elsie-heuristically.ngrok-free.dev").replace(/^https?:\/\//, "").trim(); 

// SESSION TRACKING
let conversationLog = "";
let lastCallerTranscript = ""; // Dedupe: avoid repeating same caller line and AI reply
let lastIncomingAnnounceAt = 0; // Dedupe: only send SYSTEM "INCOMING..." once per burst (Twilio may POST twice)
let firstAiGreetingSentForCall = false; // Dedupe: only send "911, What is your emergency?" once per call

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD WEBSOCKET CONNECTIONS - Real-time UI updates
// ═══════════════════════════════════════════════════════════════════════════════
const dashboardClients = new Set();

// Broadcast to all connected dashboard clients
function broadcastToDashboard(event) {
    const message = JSON.stringify(event);
    for (const client of dashboardClients) {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(message);
        }
    }
}

// Current call state for dashboard
let currentCallState = {
    isActive: false,
    streamSid: null,
    startTime: null,
    intel: null
};

// Root Route
fastify.get('/', async (request, reply) => {
    reply.send({ message: 'Twilio 911 AI Server Running!' });
});

// Normalize Twilio From to a displayable phone string (digits or E.164)
function normalizeCallerPhone(from) {
    if (from == null || typeof from !== 'string') return null;
    const raw = String(from).trim();
    if (!raw) return null;
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 10) {
        const last10 = digits.slice(-10);
        return `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
    }
    return raw;
}

// Incoming Call Route
fastify.all('/incoming-call', async (request, reply) => {
    conversationLog = ""; // Reset history
    lastCallerTranscript = "";
    firstAiGreetingSentForCall = false; // New call: allow first AI greeting once when stream starts
    const streamUrl = `wss://${NGROK_URL}/media-stream`;
    const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    // Twilio sends POST with application/x-www-form-urlencoded body; some configs use GET with query params. Merge both.
    const query = request.query || {};
    const body = request.body || {};
    const payload = { ...query, ...body };
    const rawFrom = payload.From ?? payload.from ?? payload.Caller ?? payload.CallerId;
    const callerPhone = normalizeCallerPhone(rawFrom);
    if (rawFrom != null) console.log(`📞 Twilio From (raw): ${String(rawFrom).replace(/\d(?=\d{4})/g, '*')}`);
    if (callerPhone) console.log(`📞 Caller (saved): ${callerPhone}`);
    if (!callerPhone && (request.method === 'POST' && Object.keys(body).length === 0)) {
        console.warn('⚠️ POST body empty – ensure @fastify/formbody is registered and Twilio sends application/x-www-form-urlencoded');
    }
    console.log(`📞 New Call! callId=${callId} Connecting to: ${streamUrl}`);

    await initCall(callId, { callerPhone });

    // Notify dashboard of incoming call
    currentCallState = {
        callId,
        isActive: true,
        streamSid: null,
        startTime: Date.now(),
        intel: {
            incidentType: "Incoming 911 Call",
            priority: "MEDIUM",
            location: null,
            protocols: [],
            resources: [],
            summary: "Call connected. Gathering information..."
        }
    };
    
    // Dedupe: Twilio may POST /incoming-call twice; only send call_start + SYSTEM once per ~5s
    const now = Date.now();
    if (now - lastIncomingAnnounceAt > 5000) {
        lastIncomingAnnounceAt = now;
        broadcastToDashboard({
            type: 'call_start',
            timestamp: new Date().toISOString()
        });
        broadcastToDashboard({
            type: 'transcript',
            speaker: 'SYSTEM',
            text: '── INCOMING 911 CALL ── PRIORITY: UNKNOWN ──',
            timestamp: new Date().toISOString()
        });
    }

    // Pass caller phone in Stream URL so Twilio echoes it in stream start customParameters (fallback for contactNumber)
    const streamUrlWithParams = callerPhone
        ? `${streamUrl}?callerPhone=${encodeURIComponent(callerPhone)}`
        : streamUrl;
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say>911, What is your emergency?</Say>
        <Connect>
            <Stream url="${streamUrlWithParams}" />
        </Connect>
    </Response>`;

    reply.type('text/xml').send(twiml);
});

// --- START SERVER ---
const start = async () => {
    try {
        const port = Number(PORT) || 5050;
        await fastify.listen({ port: port, host: '0.0.0.0' });
        console.log(`🚀 Server listening on port ${port}`);
        console.log(`📡 Dashboard WebSocket available at ws://localhost:${port}/dashboard`);
        console.log(`📞 Twilio webhook URL: https://${NGROK_URL}/incoming-call`);

        const wss = new WebSocketServer({ noServer: true });

        // Handle upgrade requests to route to correct WebSocket handler
        fastify.server.on('upgrade', (request, socket, head) => {
            const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
            
            if (pathname === '/media-stream') {
                // Twilio media stream connection
                wss.handleUpgrade(request, socket, head, (ws) => {
                    wss.emit('twilio-connection', ws, request);
                });
            } else if (pathname === '/dashboard') {
                // Dashboard UI connection
                wss.handleUpgrade(request, socket, head, (ws) => {
                    wss.emit('dashboard-connection', ws, request);
                });
            } else {
                socket.destroy();
            }
        });

        // ═══════════════════════════════════════════════════════════════════════════════
        // DASHBOARD WEBSOCKET HANDLER
        // ═══════════════════════════════════════════════════════════════════════════════
        wss.on('dashboard-connection', (ws) => {
            console.log('🖥️  Dashboard client connected');
            dashboardClients.add(ws);

            // Keep connection alive so it isn't dropped by idle timeouts
            const pingInterval = setInterval(() => {
                if (ws.readyState === 1) ws.ping();
            }, 25000);

            // Send current state to newly connected client
            ws.send(JSON.stringify({
                type: 'connected',
                timestamp: new Date().toISOString()
            }));

            // If there's an active call, send current state
            if (currentCallState.isActive) {
                ws.send(JSON.stringify({
                    type: 'call_start',
                    timestamp: new Date(currentCallState.startTime).toISOString()
                }));
                if (currentCallState.intel) {
                    ws.send(JSON.stringify({
                        type: 'intel',
                        data: currentCallState.intel,
                        timestamp: new Date().toISOString()
                    }));
                }
            }

            ws.on('close', () => {
                clearInterval(pingInterval);
                console.log('🖥️  Dashboard client disconnected');
                dashboardClients.delete(ws);
            });

            ws.on('error', (err) => {
                clearInterval(pingInterval);
                console.error('Dashboard WebSocket error:', err);
                dashboardClients.delete(ws);
            });
        });

        // ═══════════════════════════════════════════════════════════════════════════════
        // TWILIO MEDIA STREAM HANDLER
        // ═══════════════════════════════════════════════════════════════════════════════
        wss.on('twilio-connection', (ws) => {
            console.log('✅ Twilio Stream Connected');

            let streamSid = null;
            let audioBuffer = [];
            let silentChunks = 0;
            let isProcessing = false;
            let callActive = true;
            let lastVolumeUpdate = 0;
            let lastProcessedAt = 0;

            // --- TUNING SETTINGS ---
            const SILENCE_THRESHOLD = 200;
            const SILENCE_DURATION = 250; // 5 Seconds
            const PROCESS_COOLDOWN_MS = 3000; // Min gap between processing to avoid same utterance repeated

            ws.on('message', async (message) => {
                if (!callActive) return;

                try {
                    const data = JSON.parse(message.toString());

                    if (data.event === 'start') {
                        streamSid = data.start.streamSid;
                        currentCallState.streamSid = streamSid;
                        if (currentCallState.callId) {
                            setStreamSid(currentCallState.callId, streamSid);
                            // Fallback: set contactNumber from stream custom params if webhook didn't provide it
                            const customParams = data.start.customParameters || data.start.custom_params;
                            const streamPhone = customParams?.callerPhone ?? customParams?.From ?? customParams?.from;
                            if (streamPhone) {
                                const normalized = normalizeCallerPhone(streamPhone);
                                if (normalized) {
                                    updateCallSummary(currentCallState.callId, { contactNumber: normalized }).catch(() => {});
                                }
                            }
                        }
                        console.log(`📡 Stream started: ${streamSid}`);
                        // Send initial AI greeting once per call (Twilio may open multiple stream connections)
                        if (!firstAiGreetingSentForCall) {
                            firstAiGreetingSentForCall = true;
                            broadcastToDashboard({
                                type: 'transcript',
                                speaker: 'AI',
                                text: '911, What is your emergency?',
                                timestamp: new Date().toISOString()
                            });
                        }
                    } 
                    else if (data.event === 'media') {
                        if (isProcessing) return;

                        const chunk = Buffer.from(data.media.payload, 'base64');
                        audioBuffer.push(chunk);

                        if (audioBuffer.length > 500) audioBuffer.shift(); 

                        const energy = chunk.reduce((acc, byte) => acc + Math.abs(byte - 128), 0) / chunk.length;
                        
                        // Broadcast volume updates to dashboard (throttled to every 100ms)
                        const now = Date.now();
                        if (now - lastVolumeUpdate > 100) {
                            const normalizedVolume = Math.min(1, energy / 300);
                            broadcastToDashboard({
                                type: 'volume',
                                level: normalizedVolume,
                                timestamp: new Date().toISOString()
                            });
                            lastVolumeUpdate = now;
                        }

                        if (energy > SILENCE_THRESHOLD) {
                            silentChunks = 0; 
                        } else {
                            silentChunks++;   
                        }

                        const cooldownPassed = Date.now() - lastProcessedAt >= PROCESS_COOLDOWN_MS;
                        if (silentChunks > SILENCE_DURATION && audioBuffer.length > 20 && cooldownPassed) {
                            console.log('🗣️ User silence detected. Processing turn...');
                            lastProcessedAt = Date.now();
                            isProcessing = true;
                            const completeAudio = Buffer.concat(audioBuffer);
                            audioBuffer = [];
                            silentChunks = 0;

                            // Process the audio and check if we should end the call
                            const shouldEnd = await processAudio(completeAudio, ws, streamSid, currentCallState.callId);
                            
                            if (shouldEnd) {
                                callActive = false;
                                currentCallState.isActive = false;
                                console.log("🛑 CALL COMPLETE. IGNORING FURTHER AUDIO.");
                                
                                // Notify dashboard
                                broadcastToDashboard({
                                    type: 'call_end',
                                    duration: Math.floor((Date.now() - currentCallState.startTime) / 1000),
                                    timestamp: new Date().toISOString()
                                });
                                
                                broadcastToDashboard({
                                    type: 'transcript',
                                    speaker: 'SYSTEM',
                                    text: '── CALL ENDED ── UNITS DISPATCHED ──',
                                    timestamp: new Date().toISOString()
                                });
                            }
                            
                            isProcessing = false;
                        }
                    }
                    else if (data.event === 'stop') {
                        console.log('🛑 Stream Stopped');
                        currentCallState.isActive = false;
                        if (currentCallState.callId) endCall(currentCallState.callId, currentCallState.intel?.summary);
                        
                        broadcastToDashboard({
                            type: 'call_end',
                            duration: currentCallState.startTime ? Math.floor((Date.now() - currentCallState.startTime) / 1000) : 0,
                            timestamp: new Date().toISOString()
                        });
                        
                        // Reset volume
                        broadcastToDashboard({
                            type: 'volume',
                            level: 0,
                            timestamp: new Date().toISOString()
                        });
                    }
                } catch (error) {
                    console.error('❌ WS Message Error:', error);
                }
            });

            ws.on('close', () => {
                console.log('❌ Twilio Client Disconnected');
                if (currentCallState.isActive) {
                    currentCallState.isActive = false;
                    if (currentCallState.callId) endCall(currentCallState.callId, currentCallState.intel?.summary);
                    broadcastToDashboard({
                        type: 'call_end',
                        timestamp: new Date().toISOString()
                    });
                    broadcastToDashboard({
                        type: 'volume',
                        level: 0,
                        timestamp: new Date().toISOString()
                    });
                }
            });
        });

    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

// --- AI PROCESSING ---

async function processAudio(audioData, ws, streamSid, callId) {
    try {
        const wavHeader = createWavHeader(audioData.length);
        const wavBuffer = Buffer.concat([wavHeader, audioData]);
        const base64Audio = wavBuffer.toString('base64');

        // ═══════════════════════════════════════════════════════════════════════════════
        // ENHANCED AI PROMPT - Extracts intel for dashboard
        // ═══════════════════════════════════════════════════════════════════════════════
        const systemPrompt = `
            You are a 911 Emergency Dispatcher.
            Your manner must be: Calm, Authoritative, and Concise.

            LANGUAGE PROTOCOL:
            - If the user speaks a different language, REPLY IN THAT SAME LANGUAGE.
            - Detect the language automatically.

            CURRENT CONVERSATION HISTORY:
            ${conversationLog}

            INSTRUCTIONS:
            1. Analyze the user's input to determine the Scenario.
            2. Follow the strictly defined Checklist for that scenario.
            3. Ask ONE question at a time.
            4. Extract any location/address mentioned.
            5. Determine the priority level based on severity.
            
             *CRITICAL "ONE-SHOT" RULE (TO PREVENT LOOPS):*
            - You are allowed to ask for a checklist item *ONLY ONCE*.
            - If the user's answer is unclear, irrelevant, repeats your question, or is "I don't know":
              *DO NOT ASK AGAIN.* Mark that item as "Unknown" and IMMEDIATELY move to the next item or finalize the call.
            - NEVER repeat the exact same question twice in a row.
            - If your generated reply matches the user's input (an echo), change it to "I heard you. Please continue."

            
            *TERMINATION PROTOCOL:*
            - If you have attempted to get Location and Nature (even if failed), ask: "Is there any other information I should know?"
            - If the user says "No" (or similar):
                - REPLY: "Okay, help is on the way. Stay on the line."
                - SET 'is_final': true
            
            --- SCENARIO CHECKLISTS ---

            [SCENARIO A: ROBBERY]
            Checklist: Location -> Time -> Description
            
            [SCENARIO B: MEDICAL]
            Checklist: Location -> Symptoms -> Patient Info

            [SCENARIO C: KIDNAPPING]
            Checklist: Location -> Time -> Suspect/Vehicle Info

            
            [SCENARIO D: FIRE]
            Checklist: Location -> People Inside -> Injuries

            [SCENARIO E: ASSAULT/VIOLENCE]
            Checklist: Location -> Weapon -> Injuries -> Suspect Info

            6. Assess the caller's emotional state (sentiment) from tone and words: calm, distressed, anxious, angry, fearful, neutral.

            --- OUTPUT FORMAT ---
            Return a JSON object:
            {
              "transcript": "Exact words the user said",
              "scenario_detected": "ROBBERY | MEDICAL | KIDNAPPING | FIRE | ASSAULT | GENERAL",
              "reply": "Your response",
              "is_final": boolean (true ONLY if you are saying goodbye/dispatching),
              "caller_sentiment": "calm | distressed | anxious | angry | fearful | neutral",
              "main_concern": "One short phrase: the primary emergency or concern stated in this turn, or null",
              "intel": {
                "location_mentioned": "any address or location mentioned, or null",
                "priority": "LOW | MEDIUM | HIGH | CRITICAL",
                "injuries_reported": boolean,
                "weapons_involved": boolean,
                "people_in_danger": boolean,
                "key_details": "Brief running summary of what you know so far (2-3 sentences)"
              }
            }
        `;

        // Retry Gemini on 429 with exponential backoff
        const maxRetries = 3;
        let result;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                result = await model.generateContent([
                    systemPrompt,
                    {
                        inlineData: {
                            mimeType: "audio/wav",
                            data: base64Audio
                        }
                    }
                ]);
                break;
            } catch (genError) {
                const is429 = genError.message?.includes('429') || genError.response?.status === 429;
                if (is429 && attempt < maxRetries - 1) {
                    const delayMs = Math.min(2000 * Math.pow(2, attempt), 10000);
                    console.warn(`⚠️ Gemini 429, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`);
                    await new Promise((r) => setTimeout(r, delayMs));
                } else {
                    throw genError;
                }
            }
        }

        const responseText = result.response.text();
        const responseJson = JSON.parse(responseText);

        // Dedupe: if caller said the exact same thing again, don't repeat AI reply
        const transcriptNorm = (responseJson.transcript || '').trim().toLowerCase();
        if (transcriptNorm && transcriptNorm === lastCallerTranscript.trim().toLowerCase()) {
            console.log('🔄 Duplicate caller transcript ignored:', responseJson.transcript);
            const cannedReply = "I heard you. Please continue with your location, including city and state.";
            broadcastToDashboard({
                type: 'transcript',
                speaker: 'AI',
                text: cannedReply,
                timestamp: new Date().toISOString()
            });
            // TTS for canned reply (reuse same TTS block with cannedReply)
            const voiceId = "JBFqnCBsd6RMkjVDRZzb";
            try {
                const ttsResponse = await axios({
                    method: 'post',
                    url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=ulaw_8000`,
                    headers: {
                        'xi-api-key': ELEVENLABS_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    data: { text: cannedReply, model_id: "eleven_multilingual_v2" },
                    responseType: 'stream'
                });
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({ event: 'clear', streamSid }));
                }
                let isFirstChunk = true;
                const stream = ttsResponse.data;
                stream.on('data', (chunk) => {
                    let dataToSend = chunk;
                    if (isFirstChunk) {
                        isFirstChunk = false;
                        if (chunk.length >= 44 && chunk[0] === 0x52 && chunk[1] === 0x49) {
                            dataToSend = chunk.subarray(44);
                        }
                    }
                    const mediaMessage = {
                        event: 'media',
                        streamSid: streamSid,
                        media: { payload: dataToSend.toString('base64'), track: 'outbound' }
                    };
                    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(mediaMessage));
                });
            } catch (ttsErr) {
                console.error("❌ TTS (canned reply):", ttsErr.message);
            }
            return false;
        }
        lastCallerTranscript = transcriptNorm || lastCallerTranscript; 

        // Update History
        conversationLog += `\nUser: ${responseJson.transcript}\nDispatcher: ${responseJson.reply}`;

        console.log(`🎤 USER: "${responseJson.transcript}"`);
        console.log(`🚨 SCENARIO: [${responseJson.scenario_detected}]`);
        console.log(`🤖 REPLY: "${responseJson.reply}"`);
        
        // ═══════════════════════════════════════════════════════════════════════════════
        // BROADCAST TO DASHBOARD - Caller transcript
        // ═══════════════════════════════════════════════════════════════════════════════
        broadcastToDashboard({
            type: 'transcript',
            speaker: 'CALLER',
            text: responseJson.transcript,
            timestamp: new Date().toISOString()
        });

        // ═══════════════════════════════════════════════════════════════════════════════
        // FIREBASE: Save caller message with priority, sentiment, location, main concern
        // ═══════════════════════════════════════════════════════════════════════════════
        const intelData = responseJson.intel || {};
        const sentimentResult = sentiment.analyze(responseJson.transcript);
        const sentimentLabel = sentimentResult.score > 0 ? 'positive' : sentimentResult.score < 0 ? 'negative' : 'neutral';
        const timestamp = new Date().toISOString();
        if (callId) {
            await saveMessage(callId, {
                role: 'caller',
                text: responseJson.transcript,
                timestamp,
                mainConcern: responseJson.main_concern || formatIncidentType(responseJson.scenario_detected),
                locationMentioned: intelData.location_mentioned || null,
                priority: intelData.priority || null,
                sentiment: sentimentLabel,
                emotion: responseJson.caller_sentiment || null
            });
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        // BUILD AND BROADCAST INTEL
        // ═══════════════════════════════════════════════════════════════════════════════
        const scenarioProtocols = buildProtocols(responseJson.scenario_detected, intelData);
        const resources = buildResources(responseJson.scenario_detected, intelData);
        
        // Build location object from address string via OpenStreetMap Nominatim
        let locationObj = null;
        const locationMentioned = (intelData.location_mentioned || '').trim();
        if (locationMentioned) {
            console.log('📍 Geocoding caller address:', locationMentioned);
            const geocoded = await geocodeAddress(locationMentioned);
            if (geocoded) {
                locationObj = {
                    address: geocoded.address.toUpperCase(),
                    lat: geocoded.lat,
                    lng: geocoded.lng,
                    sector: sectorFromLatLng(geocoded.lat, geocoded.lng)
                };
                console.log('📍 Geocode result:', locationObj.address, `(${locationObj.lat}, ${locationObj.lng})`, locationObj.sector);
            } else {
                console.warn('📍 Geocode returned null for:', locationMentioned);
            }
        }
        
        currentCallState.intel = {
            incidentType: formatIncidentType(responseJson.scenario_detected),
            priority: intelData.priority || "MEDIUM",
            location: locationObj || currentCallState.intel?.location || null,
            pendingAddress: locationObj ? null : (locationMentioned || null),
            protocols: scenarioProtocols,
            resources: resources,
            summary: intelData.key_details || "Gathering information..."
        };

        // Firebase: update call summary (main concern, location, priority, running summary)
        if (callId) {
            await updateCallSummary(callId, {
                mainConcern: currentCallState.intel.incidentType,
                locationToldByCaller: intelData.location_mentioned || (currentCallState.intel?.location?.address) || null,
                priority: currentCallState.intel.priority,
                summary: currentCallState.intel.summary
            });
        }
        
        broadcastToDashboard({
            type: 'intel',
            data: currentCallState.intel,
            timestamp: new Date().toISOString()
        });

        // ═══════════════════════════════════════════════════════════════════════════════
        // TTS via ElevenLabs
        // ═══════════════════════════════════════════════════════════════════════════════
        const voiceId = "JBFqnCBsd6RMkjVDRZzb";

        let ttsResponse;
        try {
            ttsResponse = await axios({
                method: 'post',
                url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=ulaw_8000`,
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json'
                },
                data: {
                    text: responseJson.reply,
                    model_id: "eleven_multilingual_v2"
                },
                responseType: 'stream'
            });
        } catch (ttsError) {
            const status = ttsError.response?.status;
            const msg = status === 403
                ? 'ElevenLabs 403 Forbidden – check API key and that your plan allows this voice/endpoint.'
                : status === 401
                    ? 'ElevenLabs 401 Unauthorized – invalid API key.'
                    : status === 429
                        ? 'ElevenLabs 429 – quota/credits exceeded.'
                        : ttsError.message;
            console.error("❌ ELEVENLABS ERROR:", msg);
            broadcastToDashboard({
                type: 'transcript',
                speaker: 'SYSTEM',
                text: `── TTS ERROR ── ${msg} ──`,
                timestamp: new Date().toISOString()
            });
            return false;
        }

        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ event: 'clear', streamSid }));
        }

        // Broadcast AI response to dashboard
        broadcastToDashboard({
            type: 'transcript',
            speaker: 'AI',
            text: responseJson.reply,
            timestamp: new Date().toISOString()
        });

        // Firebase: save AI reply message
        if (callId) {
            await saveMessage(callId, {
                role: 'ai',
                text: responseJson.reply,
                timestamp: new Date().toISOString()
            });
        }

        let isFirstChunk = true;
        const stream = ttsResponse.data;

        stream.on('data', (chunk) => {
            let dataToSend = chunk;
            if (isFirstChunk) {
                isFirstChunk = false;
                if (chunk.length >= 44 && chunk[0] === 0x52 && chunk[1] === 0x49) {
                    dataToSend = chunk.subarray(44);
                }
            }
            const mediaMessage = {
                event: 'media',
                streamSid: streamSid,
                media: { 
                    payload: dataToSend.toString('base64'),
                    track: 'outbound'
                }
            };
            if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(mediaMessage));
        });

        // RETURN THE SIGNAL TO KILL THE CALL
        if (responseJson.is_final) {
            console.log("🏁 DISPATCH SENT. ENDING SESSION.");
            
            // Update intel to show dispatch
            const finalSummary = "Help is on the way. Units dispatched to location.";
            currentCallState.intel.summary = finalSummary;
            if (callId) await endCall(callId, finalSummary);
            broadcastToDashboard({
                type: 'intel',
                data: currentCallState.intel,
                timestamp: new Date().toISOString()
            });
            
            return true;
        }
        return false;

    } catch (error) {
        const status = error.response?.status;
        const hint = status === 403
            ? '403 Forbidden – check API key and permissions (Google AI or ElevenLabs).'
            : status === 401
                ? '401 Unauthorized – invalid or missing API key.'
                : error.message;
        console.error("❌ ERROR IN AI PIPELINE:", hint);
        broadcastToDashboard({
            type: 'transcript',
            speaker: 'SYSTEM',
            text: `── PROCESSING ERROR ── ${hint} ──`,
            timestamp: new Date().toISOString()
        });
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS - Build intel data for dashboard
// ═══════════════════════════════════════════════════════════════════════════════

function formatIncidentType(scenario) {
    const types = {
        'ROBBERY': 'Armed Robbery',
        'MEDICAL': 'Medical Emergency',
        'KIDNAPPING': 'Kidnapping / Abduction',
        'FIRE': 'Structure Fire',
        'ASSAULT': 'Assault / Violence',
        'GENERAL': 'Emergency Call'
    };
    return types[scenario] || 'Emergency Call';
}

function buildProtocols(scenario, intel) {
    const protocols = [];
    
    // Base protocol for scenario
    const scenarioProtocols = {
        'ROBBERY': { id: 'robbery', label: 'Robbery Protocol', description: 'Armed robbery reported. Officer safety priority.', priority: 'HIGH' },
        'MEDICAL': { id: 'medical', label: 'Medical Protocol', description: 'Medical emergency. EMS dispatch required.', priority: 'HIGH' },
        'KIDNAPPING': { id: 'kidnapping', label: 'Amber Alert Protocol', description: 'Possible abduction. Time-critical response.', priority: 'CRITICAL' },
        'FIRE': { id: 'fire', label: 'Fire Protocol', description: 'Structure fire reported. Fire suppression required.', priority: 'HIGH' },
        'ASSAULT': { id: 'assault', label: 'Violence Protocol', description: 'Assault in progress. Officer response required.', priority: 'HIGH' },
    };
    
    if (scenarioProtocols[scenario]) {
        protocols.push(scenarioProtocols[scenario]);
    }
    
    // Additional protocols based on intel
    if (intel.injuries_reported) {
        protocols.push({
            id: 'injury',
            label: 'Injury Protocol',
            description: 'Injuries reported at scene. Medical response required.',
            priority: 'CRITICAL'
        });
    }
    
    if (intel.weapons_involved) {
        protocols.push({
            id: 'weapons',
            label: 'Armed Response',
            description: 'Weapons reported. Tactical response may be required.',
            priority: 'CRITICAL'
        });
    }
    
    if (intel.people_in_danger) {
        protocols.push({
            id: 'rescue',
            label: 'Rescue Ops',
            description: 'People in immediate danger. Priority extraction.',
            priority: 'CRITICAL'
        });
    }
    
    return protocols;
}

function buildResources(scenario, intel) {
    const resources = [];
    let resourceId = 1;
    
    // Always dispatch police for most scenarios
    if (['ROBBERY', 'KIDNAPPING', 'ASSAULT', 'GENERAL'].includes(scenario)) {
        resources.push({
            id: `r${resourceId++}`,
            type: 'Police',
            unit: `Unit ${Math.floor(Math.random() * 50) + 1}`,
            status: 'Dispatched',
            eta: Math.floor(Math.random() * 300) + 120
        });
    }
    
    // Fire for fire incidents
    if (scenario === 'FIRE') {
        resources.push({
            id: `r${resourceId++}`,
            type: 'Fire',
            unit: `Engine ${Math.floor(Math.random() * 20) + 1}`,
            status: 'Dispatched',
            eta: Math.floor(Math.random() * 240) + 180
        });
        resources.push({
            id: `r${resourceId++}`,
            type: 'Fire',
            unit: `Ladder ${Math.floor(Math.random() * 15) + 1}`,
            status: 'Dispatched',
            eta: Math.floor(Math.random() * 300) + 240
        });
    }
    
    // EMS for medical or injuries
    if (scenario === 'MEDICAL' || intel.injuries_reported) {
        resources.push({
            id: `r${resourceId++}`,
            type: 'EMS',
            unit: `Medic ${Math.floor(Math.random() * 10) + 1}`,
            status: 'Dispatched',
            eta: Math.floor(Math.random() * 300) + 180
        });
    }
    
    // Additional police for dangerous situations
    if (intel.weapons_involved || intel.people_in_danger) {
        resources.push({
            id: `r${resourceId++}`,
            type: 'Police',
            unit: `Unit ${Math.floor(Math.random() * 50) + 50}`,
            status: 'Dispatched',
            eta: Math.floor(Math.random() * 180) + 120
        });
    }
    
    return resources;
}

// ══════════════════════════════════════════════════════════════════════════════
// OPENSTREETMAP NOMINATIM GEOCODING (address string → lat/lng)
// Usage policy: max 1 req/s. We add a delay before each request.
// ══════════════════════════════════════════════════════════════════════════════
const geocodeCache = new Map();
const NOMINATIM_DELAY_MS = 1100; // Stay safely above 1 req/s
const NOMINATIM_TIMEOUT_MS = 15000;

async function geocodeAddress(rawAddress) {
    const address = String(rawAddress || '').trim();
    if (!address) {
        console.log('[geocode] empty address, skip');
        return null;
    }
    if (geocodeCache.has(address)) {
        console.log('[geocode] cache hit:', address);
        return geocodeCache.get(address);
    }

    console.log('[geocode] Nominatim request:', address);
    // Respect Nominatim rate limit (1 req/s)
    await new Promise((r) => setTimeout(r, NOMINATIM_DELAY_MS));

    try {
        const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: { q: address, format: 'json', limit: 1, addressdetails: 1 },
            headers: { 'User-Agent': 'UGAHacks11-DispatchCenter/1.0 (contact: local-dev)' },
            timeout: NOMINATIM_TIMEOUT_MS
        });
        const result = Array.isArray(data) ? data[0] : null;
        if (!result) {
            console.warn('[geocode] no result for:', address);
            return null;
        }
        const lat = Number(result.lat);
        const lng = Number(result.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            console.warn('[geocode] invalid lat/lng:', { lat, lng }, address);
            return null;
        }
        const resolved = {
            address: result.display_name || address,
            lat,
            lng
        };
        geocodeCache.set(address, resolved);
        console.log('[geocode] resolved:', address, '→', lat, lng);
        return resolved;
    } catch (err) {
        console.warn('[geocode] failed:', err.message || err, address);
        return null;
    }
}

// Derive a deterministic sector label from lat/lng
function sectorFromLatLng(lat, lng) {
    const n = Math.abs(Math.floor((lat * 1000) + (lng * 1000))) % 12;
    const letter = String.fromCharCode(65 + (Math.abs(Math.floor(lat * 10)) % 7));
    return `SECTOR ${n + 1}-${letter}`;
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