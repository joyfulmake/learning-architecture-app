import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppStateProvider } from "./providers";
import { NavTabs } from "@/components/NavTabs";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Learning Architecture",
  description: "Phased dependency maps and judgment-testing challenges for any topic.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-gray-900">
        <AppStateProvider>
          <NavTabs />
          <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-8">{children}</main>
        </AppStateProvider>
      </body>
    </html>
  );
}
