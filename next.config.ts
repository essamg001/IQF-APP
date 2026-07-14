import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Certificate scans/PDFs can run a few MB — default 1MB limit is too tight.
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
