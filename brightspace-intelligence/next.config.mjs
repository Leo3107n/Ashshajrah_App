import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  turbopack: {
    root: __dirname,
  },
  // Permit development clients reaching Next through either the Wi-Fi adapter
  // or Expo/Windows' active local-network adapter. This only affects dev mode.
  allowedDevOrigins: ["192.168.1.3", "192.168.225.1"],
};

export default nextConfig;
