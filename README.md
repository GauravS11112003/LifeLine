# AI-Powered 911 Emergency Response System

A comprehensive emergency response system that combines AI-powered voice agents with a real-time dispatch center dashboard. Built for UGAHacks11.

## Team Members

- **Gaurav Shrivastava**
- **Kavya Gupta**
- **Pranay Joshi**
- **Priyanshu Sethi**

## Overview

This project consists of two main components:

1. **AI Phone Agent** - A backend service that handles incoming emergency calls, uses AI to understand and respond to callers, and extracts critical information in real-time.

2. **Dispatch Center** - A modern web dashboard that provides dispatchers with live call transcripts, incident mapping, intelligence extraction, and call history management.

## Features

### AI Phone Agent
- 🤖 **AI-Powered Conversations** - Uses Google Gemini AI to understand emergency situations and gather critical information
- 🎙️ **Natural Voice Interaction** - Text-to-speech via ElevenLabs for natural, human-like responses
- 📞 **Twilio Integration** - Handles incoming calls and manages call sessions
- 💬 **Real-time Transcription** - Live transcription of caller audio
- 🧠 **Sentiment Analysis** - Analyzes caller sentiment to prioritize urgent situations
- 📊 **Structured Data Extraction** - Automatically extracts location, incident type, injuries, weapons, and other critical details
- 🔄 **WebSocket Streaming** - Real-time updates to dispatch center dashboard
- 💾 **Firebase Integration** - Stores call logs, transcripts, and extracted intelligence

### Dispatch Center Dashboard
- 📍 **Live Incident Map** - Real-time visualization of emergency locations using interactive maps
- 📝 **Live Transcripts** - Real-time display of call conversations
- 🎯 **Intel Deck** - Extracted intelligence including incident type, location, injuries, weapons, and more
- 📊 **Call History** - View and manage past emergency calls
- 🎨 **Audio Visualization** - Visual representation of call audio
- 🔄 **Real-time Updates** - WebSocket-based live updates for active calls
- 📱 **Modern UI** - Built with Next.js, React, and Tailwind CSS

## Project Structure

```
ugahacks11/
├── ai-phone-agentjs/     # Backend AI phone agent service
│   ├── index.js          # Main server file
│   ├── firebase.js       # Firebase integration
│   └── package.json      # Dependencies
│
└── dispatch-center/       # Frontend dispatch dashboard
    ├── src/
    │   ├── app/          # Next.js app router pages
    │   ├── components/   # React components
    │   ├── hooks/        # Custom React hooks
    │   └── lib/          # Utility functions
    └── package.json      # Dependencies
```

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Firebase project with Firestore enabled
- Twilio account with phone number
- Google Cloud API key (for Gemini AI)
- ElevenLabs API key (for text-to-speech)
- ngrok or similar tunneling service (for local development)

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd ugahacks11
```

### 2. Set up AI Phone Agent

```bash
cd ai-phone-agentjs
npm install
```

Create a `.env` file in the `ai-phone-agentjs` directory:

```env
GOOGLE_API_KEY=your_google_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
PUBLIC_DOMAIN=your_ngrok_url_or_domain
PORT=3000
```

### 3. Set up Dispatch Center

```bash
cd dispatch-center
npm install
```

Create a `.env.local` file in the `dispatch-center` directory:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
```

## Running the Project

### Start the AI Phone Agent

```bash
cd ai-phone-agentjs
npm start
```

The server will start on port 3000 (or the port specified in your `.env` file).

### Start the Dispatch Center

```bash
cd dispatch-center
npm run dev
```

The dashboard will be available at `http://localhost:3000`.

### Configure Twilio Webhooks

1. Set up ngrok or deploy your backend to a public URL
2. In your Twilio console, configure your phone number's webhook URL:
   - Voice webhook: `https://your-domain.com/incoming-call`
   - Status callback: `https://your-domain.com/call-status`

## Technology Stack

### Backend (AI Phone Agent)
- **Fastify** - Fast web framework
- **Google Gemini AI** - Natural language understanding
- **ElevenLabs** - Text-to-speech synthesis
- **Twilio** - Voice call handling
- **Firebase** - Real-time database
- **WebSocket** - Real-time communication
- **Sentiment** - Sentiment analysis

### Frontend (Dispatch Center)
- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **React Leaflet** - Map visualization
- **Firebase** - Real-time data sync
- **Radix UI** - Accessible components

## Key Features in Detail

### Intelligent Call Handling
The AI agent uses structured conversation flow to gather:
- Incident type (Robbery, Medical, Fire, Assault, etc.)
- Location information
- Injury status
- Weapon involvement
- People in danger
- Suspect descriptions (for crimes)
- Patient information (for medical emergencies)

### Real-time Dashboard
The dispatch center provides:
- Live call monitoring
- Automatic intelligence extraction
- Geographic incident visualization
- Call history and search
- Audio visualization
- Status tracking

## Development

### Running in Development Mode

For the AI Phone Agent:
```bash
cd ai-phone-agentjs
npm run dev
```

For the Dispatch Center:
```bash
cd dispatch-center
npm run dev
```

## License

ISC

## Acknowledgments

Built for UGAHacks11 hackathon.
