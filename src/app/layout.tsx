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
  title: "SecureShare | Zero-Knowledge File Control",
  description: "Client-side encrypted file sharing controlled by wallets and threshold approvals",
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
          <header className="site-header">
            <div className="site-nav flex items-center justify-between gap-4">
              <Link href="/" className="brand-mark"><span className="brand-glyph">SS</span><span>SecureShare</span></Link>
              <nav className="nav-rail hidden sm:flex">
                <Link href="/" className="nav-link">Home</Link>
                <Link href="/upload" className="nav-link">Upload</Link>
                <Link href="/download" className="nav-link">Download</Link>
                <Link href="/dashboard" className="nav-link">Dashboard</Link>
              </nav>
              <div className="flex items-center gap-3">
                <NetworkIndicator />
                <HeaderStatus />
                <AccountMenu />
              </div>
            </div>
          </header>
          <main>{children}</main>
          <nav className="mobile-dock sm:hidden" aria-label="Mobile navigation">
            <Link href="/">Home</Link>
            <Link href="/upload">Upload</Link>
            <Link href="/download">Decrypt</Link>
            <Link href="/dashboard">Control</Link>
          </nav>
        </Providers>
      </body>
    </html>
  );
}
