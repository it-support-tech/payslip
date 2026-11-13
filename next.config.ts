import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "") || undefined,
  // ບໍ່ໃຫ້ Next.js bundle package ເຫຼົ່ານີ້ (ຕ້ອງໃຊ້ native Node / ໄຟລ໌ໃນ node_modules)
  serverExternalPackages: ["whatsapp-web.js", "puppeteer", "pdfkit", "fontkit", "xlsx", "pg"],
};

export default nextConfig;
