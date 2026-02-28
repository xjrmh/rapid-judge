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
    "LLM-as-judge evaluation lifecycle: datasets, ad-hoc evaluation, experiments, rubric versioning, and judge QA.",
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
          <footer className="mt-auto py-4 text-center text-xs text-muted-foreground">
            © 2026{" "}
            <a
              href="https://www.xjrmh.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground underline underline-offset-2"
            >
              xjrmh
            </a>
            . Pre-alpha build.
          </footer>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
