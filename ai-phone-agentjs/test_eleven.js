import { ElevenLabsClient } from "elevenlabs";
import dotenv from "dotenv";
import fs from "fs";

// Load environment variables
dotenv.config();

const { ELEVENLABS_API_KEY } = process.env;

if (!ELEVENLABS_API_KEY) {
    console.error("❌ ERROR: Missing ELEVENLABS_API_KEY in .env file");
    process.exit(1);
}

const client = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY });

async function runTest() {
    console.log("🔍 Testing ElevenLabs API...");
    console.log(`🔑 Using Key: ${ELEVENLABS_API_KEY.substring(0, 5)}...`);

    try {
        console.log("🔊 Requesting audio...");
        
        const audioStream = await client.textToSpeech.convert(
            "JBFqnCBsd6RMkjVDRZzb", // Voice ID (George)
            {
                text: "Hello! If you can hear this, your Eleven Labs API key is working perfectly.",
                model_id: "eleven_turbo_v2",
                output_format: "mp3_44100_128" // Standard MP3 for testing
            }
        );

        // Save to file
        const fileName = "test_audio.mp3";
        const fileStream = fs.createWriteStream(fileName);

        for await (const chunk of audioStream) {
            fileStream.write(chunk);
        }

        fileStream.end();
        console.log(`✅ SUCCESS! Audio saved to '${fileName}'`);
        console.log("👉 Please open this file and check if you hear the voice.");

    } catch (error) {
        console.error("❌ API ERROR:");
        console.error(error.message);

        if (error.statusCode === 401) {
            console.log("💡 DIAGNOSIS: Your API Key is invalid.");
        }
        if (error.statusCode === 429) {
            console.log("💡 DIAGNOSIS: You have run out of credits.");
        }
    }
}

runTest();