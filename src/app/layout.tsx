import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "@/components/nav";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rapid Judge — LLM Evaluation",
  description:
    "Automated LLM-as-judge evaluation with single scoring, pairwise comparison, and batch processing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}
      >
        <Providers>
          <Nav />
          <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
