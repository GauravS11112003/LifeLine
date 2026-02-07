/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/voice-agent/:path*",
        destination: `${
          process.env.VOICE_AGENT_URL || "http://localhost:5000"
        }/:path*`,
      },
    ];
  },
};

export default nextConfig;
