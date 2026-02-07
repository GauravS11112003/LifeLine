import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
    console.error("❌ No API Key found in .env file!");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function checkModels() {
    console.log("🔍 Checking available models for your API key...");
    
    try {
        // This is the direct API call to list everything you have access to
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.error) {
            console.error("❌ API Error:", data.error.message);
            return;
        }

        const models = data.models || [];
        
        // Filter only for models that can "Generate Content" (Chat/Text)
        const validModels = models.filter(m => m.supportedGenerationMethods.includes("generateContent"));

        if (validModels.length === 0) {
            console.log("⚠️ No chat models found. Your key might be for the wrong project type.");
        } else {
            console.log("\n✅ AVAILABLE MODELS (Copy one of these exactly):");
            console.log("------------------------------------------------");
            validModels.forEach(m => {
                // We strip the 'models/' prefix so it's ready to paste
                console.log(`"${m.name.replace('models/', '')}"`);
            });
            console.log("------------------------------------------------");
        }

    } catch (error) {
        console.error("❌ Network or Script Error:", error);
    }
}

checkModels();