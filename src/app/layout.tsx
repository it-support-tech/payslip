import type { Metadata } from "next";
import { Inter, Noto_Sans_Lao } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const notoLao = Noto_Sans_Lao({ variable: "--font-lao", subsets: ["lao"] });

export const metadata: Metadata = {
  title: "NTP Payslip",
  description: "ສ້າງ ແລະ ສົ່ງPayslipໃຫ້ພະນັກງານຜ່ານ WhatsApp",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="lo">
      <body className={`${inter.variable} ${notoLao.variable} antialiased`}>{children}</body>
    </html>
  );
}
