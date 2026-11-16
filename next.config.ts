import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "") || undefined,
  serverExternalPackages: ["whatsapp-web.js", "puppeteer", "pdfkit", "fontkit", "xlsx", "pg"],
};

export default nextConfig;
