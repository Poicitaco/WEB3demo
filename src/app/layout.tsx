import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from 'next/link';
import AccountMenu from '@/components/AccountMenu';
import HeaderStatus from '@/components/HeaderStatus';
import NetworkIndicator from '@/components/NetworkIndicator';
import Providers from '@/components/Providers';
import WalletSessionNotice from '@/components/WalletSessionNotice';
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
  title: "Vaultline | Chia sẻ tài liệu riêng tư",
  description: "Gửi tài liệu quan trọng và giữ quyền kiểm soát sau khi chia sẻ.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <header className="site-header brand-nav-proxy">
            <div className="site-nav flex items-center justify-between gap-4">
              <Link href="/" className="brand-mark"><span className="brand-glyph"><i /></span><span>VAULTLINE</span></Link>
              <nav className="nav-rail hidden sm:flex">
                <Link href="/" className="nav-link">Khám phá</Link>
                <Link href="/upload" className="nav-link">Gửi tệp</Link>
                <Link href="/download" className="nav-link">Nhận tệp</Link>
                <Link href="/dashboard" className="nav-link">Không gian của bạn</Link>
              </nav>
              <div className="flex items-center gap-3">
                <NetworkIndicator />
                <HeaderStatus />
                <AccountMenu />
              </div>
            </div>
          </header>
          <WalletSessionNotice />
          <main>{children}</main>
          <nav className="mobile-dock sm:hidden" aria-label="Mobile navigation">
            <Link href="/">Khám phá</Link>
            <Link href="/upload">Gửi tệp</Link>
            <Link href="/download">Nhận tệp</Link>
            <Link href="/dashboard">Của bạn</Link>
          </nav>
        </Providers>
      </body>
    </html>
  );
}
