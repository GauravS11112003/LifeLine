import Fastify from 'fastify';
import fastifyFormBody from '@fastify/formbody';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios'; 
import { WebSocketServer } from 'ws';

// Load keys
dotenv.config();
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

const NGROK_URL = "nonaphetic-stephnie-thetically.ngrok-free.dev"; 

// SESSION TRACKING
let conversationLog = "";

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

// Incoming Call Route
fastify.all('/incoming-call', async (request, reply) => {
    conversationLog = ""; // Reset history
    const streamUrl = `wss://${NGROK_URL}/media-stream`;
    console.log(`📞 New Call! Connecting to: ${streamUrl}`);

    // Notify dashboard of incoming call
    currentCallState = {
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

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say>911, What is your emergency?</Say>
        <Connect>
            <Stream url="${streamUrl}" />
        </Connect>
    </Response>`;

    reply.type('text/xml').send(twiml);
});

// --- START SERVER ---
const start = async () => {
    try {
        const port = PORT || 5000;
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
                console.log('🖥️  Dashboard client disconnected');
                dashboardClients.delete(ws);
            });
            
            ws.on('error', (err) => {
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

            // --- TUNING SETTINGS ---
            const SILENCE_THRESHOLD = 200; 
            const SILENCE_DURATION = 250; // 5 Seconds

            ws.on('message', async (message) => {
                if (!callActive) return;

                try {
                    const data = JSON.parse(message.toString());

                    if (data.event === 'start') {
                        streamSid = data.start.streamSid;
                        currentCallState.streamSid = streamSid;
                        console.log(`📡 Stream started: ${streamSid}`);
                        
                        // Send initial AI greeting to dashboard
                        broadcastToDashboard({
                            type: 'transcript',
                            speaker: 'AI',
                            text: '911, What is your emergency?',
                            timestamp: new Date().toISOString()
                        });
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

                        if (silentChunks > SILENCE_DURATION && audioBuffer.length > 20) {
                            console.log('🗣️ User silence detected. Processing turn...');
                            
                            isProcessing = true;
                            const completeAudio = Buffer.concat(audioBuffer);
                            audioBuffer = [];
                            silentChunks = 0;

                            // Process the audio and check if we should end the call
                            const shouldEnd = await processAudio(completeAudio, ws, streamSid);
                            
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

async function processAudio(audioData, ws, streamSid) {
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

            CURRENT CONVERSATION HISTORY:
            ${conversationLog}

            INSTRUCTIONS:
            1. Analyze the user's input to determine the Scenario.
            2. Follow the strictly defined Checklist for that scenario.
            3. Ask ONE question at a time.
            4. Extract any location/address mentioned.
            5. Determine the priority level based on severity.
            
            **TERMINATION PROTOCOL (CRITICAL):**
            - If you have gathered the Location and Nature of the emergency, ask: "Is there any other information I should know?"
            - If the user says "No", "That's it", or "Nope" to that question:
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

            --- OUTPUT FORMAT ---
            Return a JSON object:
            {
              "transcript": "Exact words the user said",
              "scenario_detected": "ROBBERY | MEDICAL | KIDNAPPING | FIRE | ASSAULT | GENERAL",
              "reply": "Your response",
              "is_final": boolean (true ONLY if you are saying goodbye/dispatching),
              "intel": {
                "location_mentioned": "any address or location mentioned, or null",
                "priority": "LOW | MEDIUM | HIGH | CRITICAL",
                "injuries_reported": boolean,
                "weapons_involved": boolean,
                "people_in_danger": boolean,
                "key_details": "Brief summary of what you know so far"
              }
            }
        `;

        const result = await model.generateContent([
            systemPrompt,
            {
                inlineData: {
                    mimeType: "audio/wav",
                    data: base64Audio
                }
            }
        ]);

        const responseText = result.response.text();
        const responseJson = JSON.parse(responseText); 

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
        // BUILD AND BROADCAST INTEL
        // ═══════════════════════════════════════════════════════════════════════════════
        const intelData = responseJson.intel || {};
        const scenarioProtocols = buildProtocols(responseJson.scenario_detected, intelData);
        const resources = buildResources(responseJson.scenario_detected, intelData);
        
        // Build location object if address was mentioned
        let locationObj = null;
        if (intelData.location_mentioned) {
            // Use a default location for demo, in production you'd geocode
            locationObj = {
                address: intelData.location_mentioned.toUpperCase(),
                lat: 40.7589 + (Math.random() - 0.5) * 0.01,
                lng: -73.9851 + (Math.random() - 0.5) * 0.01,
                sector: `SECTOR ${Math.floor(Math.random() * 12) + 1}-${String.fromCharCode(65 + Math.floor(Math.random() * 7))}`
            };
        }
        
        currentCallState.intel = {
            incidentType: formatIncidentType(responseJson.scenario_detected),
            priority: intelData.priority || "MEDIUM",
            location: locationObj || currentCallState.intel?.location || null,
            protocols: scenarioProtocols,
            resources: resources,
            summary: intelData.key_details || "Gathering information..."
        };
        
        broadcastToDashboard({
            type: 'intel',
            data: currentCallState.intel,
            timestamp: new Date().toISOString()
        });

        // ═══════════════════════════════════════════════════════════════════════════════
        // TTS via ElevenLabs
        // ═══════════════════════════════════════════════════════════════════════════════
        const voiceId = "JBFqnCBsd6RMkjVDRZzb"; 
        
        const response = await axios({
            method: 'post',
            url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=ulaw_8000`,
            headers: { 
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            },
            data: {
                text: responseJson.reply, 
                model_id: "eleven_turbo_v2"
            },
            responseType: 'stream'
        });

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

        let isFirstChunk = true;
        const stream = response.data;

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
            currentCallState.intel.summary = "Help is on the way. Units dispatched to location.";
            broadcastToDashboard({
                type: 'intel',
                data: currentCallState.intel,
                timestamp: new Date().toISOString()
            });
            
            return true;
        }
        return false;

    } catch (error) {
        console.error("❌ ERROR IN AI PIPELINE:", error.message);
        broadcastToDashboard({
            type: 'transcript',
            speaker: 'SYSTEM',
            text: `── PROCESSING ERROR ── ${error.message} ──`,
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