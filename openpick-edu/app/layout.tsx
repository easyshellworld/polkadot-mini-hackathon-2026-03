import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

// Use simpler font loading for Chinese characters to avoid Turbopack issues
const notoSansSC = { variable: "--font-noto-sans-sc" };

export const metadata: Metadata = {
  title: "OpenPick - Education platform",
  description: "AI-powered chatbot that teaches users about NFT minting, helps them automatically mint NFTs, customize the development of smart contracts, and build an AI-powered Web3 education platform.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Default to English for the root layout
  // The locale will be set in the [locale]/layout.tsx through a different approach
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSansSC.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
