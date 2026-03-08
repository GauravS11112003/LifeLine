/**
 * Firebase Realtime Database client for dispatch-center.
 * Uses same project as ai-phone-agentjs; set NEXT_PUBLIC_FIREBASE_DATABASE_URL in .env.local.
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getDatabase, ref, onValue, type Database, type DatabaseReference } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCCwyAGpFquYJSq-KzDniQ-rKbPtKmpnGI",
  authDomain: "one1-e0a88.firebaseapp.com",
  projectId: "one1-e0a88",
  storageBucket: "one1-e0a88.firebasestorage.app",
  messagingSenderId: "328278097830",
  appId: "1:328278097830:web:178ba7c7a44fa4b7995967",
  measurementId: "G-TMRFTKP2NH",
};

const databaseURL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
        "https://one1-e0a88-default-rtdb.us-central1.firebasedatabase.app")
    : undefined;

let app: FirebaseApp | null = null;
let db: Database | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length ? (getApps()[0] as FirebaseApp) : initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseDb(): Database {
  if (!db) {
    if (!databaseURL) throw new Error("Firebase database URL not set (NEXT_PUBLIC_FIREBASE_DATABASE_URL)");
    db = getDatabase(getFirebaseApp(), databaseURL);
  }
  return db;
}

export function callsRef(): DatabaseReference {
  return ref(getFirebaseDb(), "calls");
}

export function callRef(callId: string): DatabaseReference {
  return ref(getFirebaseDb(), `calls/${callId}`);
}

export function callMessagesRef(callId: string): DatabaseReference {
  return ref(getFirebaseDb(), `calls/${callId}/messages`);
}
