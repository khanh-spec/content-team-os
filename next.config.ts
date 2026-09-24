import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse ships pdf.js with a worker file; keep it out of the bundle.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
