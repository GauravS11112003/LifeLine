import { spawn } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const { NGROK_AUTH_TOKEN, PORT } = process.env;
const port = PORT || 5050;
const NGROK_DOMAIN = "nonaphetic-stephnie-thetically.ngrok-free.dev";

async function startNgrok() {
    if (!NGROK_AUTH_TOKEN) {
        console.error('❌ NGROK_AUTH_TOKEN not found in .env file');
        process.exit(1);
    }

    console.log('🔧 Configuring ngrok authtoken...');
    
    // Configure ngrok authtoken
    const configProcess = spawn('npx', ['ngrok', 'config', 'add-authtoken', NGROK_AUTH_TOKEN], {
        shell: true,
        stdio: 'inherit'
    });

    await new Promise((resolve, reject) => {
        configProcess.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`ngrok config failed with code ${code}`));
        });
    });

    console.log('🚀 Starting ngrok tunnel...');
    
    // Start ngrok tunnel
    const ngrokProcess = spawn('npx', ['ngrok', 'http', port.toString(), `--url=${NGROK_DOMAIN}`], {
        shell: true,
        stdio: 'inherit'
    });

    ngrokProcess.on('error', (err) => {
        console.error('❌ Failed to start ngrok:', err);
    });

    // Give ngrok time to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log(`✅ Ngrok tunnel active at https://${NGROK_DOMAIN}`);
    console.log('🚀 Starting voice agent server...');

    // Start the main server
    const serverProcess = spawn('node', ['index.js'], {
        shell: true,
        stdio: 'inherit',
        cwd: process.cwd()
    });

    serverProcess.on('error', (err) => {
        console.error('❌ Failed to start server:', err);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down...');
        ngrokProcess.kill();
        serverProcess.kill();
        process.exit(0);
    });
}

startNgrok().catch(console.error);
