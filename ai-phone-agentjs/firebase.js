/**
 * Firebase Realtime Database integration for 911 call logging.
 * Saves each message with main concern, location, priority, sentiment, and running summary.
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, update, push } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCCwyAGpFquYJSq-KzDniQ-rKbPtKmpnGI",
  authDomain: "one1-e0a88.firebaseapp.com",
  projectId: "one1-e0a88",
  storageBucket: "one1-e0a88.firebasestorage.app",
  messagingSenderId: "328278097830",
  appId: "1:328278097830:web:178ba7c7a44fa4b7995967",
  measurementId: "G-TMRFTKP2NH"
};

const app = initializeApp(firebaseConfig);

// Lazy init so FIREBASE_DATABASE_URL from .env (loaded in index.js) is respected.
// Get the exact URL from Firebase Console → Build → Realtime Database (top of page).
// US (Iowa): https://one1-e0a88.firebaseio.com
// Or newer format: https://one1-e0a88-default-rtdb.<region>.firebasedatabase.app
let db = null;
function getDb() {
    if (!db) {
        const url = process.env.FIREBASE_DATABASE_URL || "https://one1-e0a88-default-rtdb.us-central1.firebasedatabase.app";
        db = getDatabase(app, url);
    }
    return db;
}

/**
 * Initialize a new call in the database (call on incoming call).
 * @param {string} callId - Unique call id (e.g. call_1234567890_abc)
 * @param {object} opts - Optional: { callerPhone } (caller number from Twilio From)
 */
export function initCall(callId, opts = {}) {
  if (!callId) return Promise.resolve();
  const payload = {
    callId,
    startTime: new Date().toISOString(),
    status: 'active',
    streamSid: null,
    mainConcern: null,
    locationToldByCaller: null,
    priority: 'TBD',
    summary: 'Call connected. Gathering information...',
    contactNumber: opts.callerPhone ?? null,
  };
  return set(ref(getDb(), `calls/${callId}`), payload).catch((err) => {
    console.error('Firebase initCall error:', err.message);
  });
}

/**
 * Update call with streamSid when Twilio stream connects.
 */
export function setStreamSid(callId, streamSid) {
  if (!callId || !streamSid) return Promise.resolve();
  return update(ref(getDb(), `calls/${callId}`), { streamSid }).catch((err) => {
    console.error('Firebase setStreamSid error:', err.message);
  });
}

/**
 * Save a single message (caller or AI) with extracted metadata.
 * @param {string} callId
 * @param {object} msg - { role: 'caller'|'ai'|'system', text, mainConcern?, locationMentioned?, priority?, sentiment?, emotion?, timestamp? }
 */
export function saveMessage(callId, msg) {
  if (!callId || !msg?.text) return Promise.resolve();
  const payload = {
    role: msg.role || 'caller',
    text: msg.text,
    timestamp: msg.timestamp || new Date().toISOString(),
    ...(msg.mainConcern != null && { mainConcern: msg.mainConcern }),
    ...(msg.locationMentioned != null && { locationMentioned: msg.locationMentioned }),
    ...(msg.priority != null && { priority: msg.priority }),
    ...(msg.sentiment != null && { sentiment: msg.sentiment }),
    ...(msg.emotion != null && { emotion: msg.emotion })
  };
  return push(ref(getDb(), `calls/${callId}/messages`), payload).catch((err) => {
    console.error('Firebase saveMessage error:', err.message);
  });
}

/**
 * Update the call's running summary and extracted fields (main concern, location, priority).
 */
export function updateCallSummary(callId, data) {
  if (!callId) return Promise.resolve();
  const updates = {};
  if (data.mainConcern != null) updates.mainConcern = data.mainConcern;
  if (data.locationToldByCaller != null) updates.locationToldByCaller = data.locationToldByCaller;
  if (data.priority != null) updates.priority = data.priority;
  if (data.summary != null) updates.summary = data.summary;
  if (data.contactNumber != null) updates.contactNumber = data.contactNumber;
  if (Object.keys(updates).length === 0) return Promise.resolve();
  return update(ref(getDb(), `calls/${callId}`), updates).catch((err) => {
    console.error('Firebase updateCallSummary error:', err.message);
  });
}

/**
 * Mark call as ended and set final summary.
 */
export function endCall(callId, finalSummary) {
  if (!callId) return Promise.resolve();
  return update(ref(getDb(), `calls/${callId}`), {
    status: 'ended',
    endTime: new Date().toISOString(),
    ...(finalSummary != null && { summary: finalSummary })
  }).catch((err) => {
    console.error('Firebase endCall error:', err.message);
  });
}
