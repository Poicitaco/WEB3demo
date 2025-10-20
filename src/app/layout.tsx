import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from 'next/link';
import AccountMenu from '@/components/AccountMenu';
import HeaderStatus from '@/components/HeaderStatus';
import NetworkIndicator from '@/components/NetworkIndicator';
import Providers from '@/components/Providers';
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
  title: "SecureShare",
  description: "Client-side encrypted file sharing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <header className="sticky top-0 z-50">
            <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-4">
              <div className="text-sm font-semibold tracking-wide">SecureShare</div>
              <nav className="glass px-3 py-1 rounded-full text-sm hidden sm:flex gap-4">
                <Link href="/" className="hover:text-accent-3">Home</Link>
                <Link href="/upload" className="hover:text-accent-3">Upload</Link>
                <Link href="/download" className="hover:text-accent-3">Download</Link>
                <Link href="/dashboard" className="hover:text-accent-3">Dashboard</Link>
              </nav>
              <div className="flex items-center gap-3">
                <NetworkIndicator />
                <HeaderStatus />
                <AccountMenu />
              </div>
            </div>
          </header>
          <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
