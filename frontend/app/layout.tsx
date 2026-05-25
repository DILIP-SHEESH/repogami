import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Repogami — See what breaks before you ship",
  description:
    "Paste any public GitHub repo. Get a 3D import graph, Touch Index, Repo DNA card, blast radius, and onboarding compass — free, no login.",
  openGraph: {
    title: "Repogami",
    description:
      "Structural intelligence for GitHub repos — gravity wells, health score, shareable DNA.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Repogami",
    description:
      "Paste a GitHub URL. See what breaks before you ship.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
