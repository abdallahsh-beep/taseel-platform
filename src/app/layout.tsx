import type { Metadata } from "next";
import { qomra, sakkal } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "روزنامة تأصيل | منصة إدارة المحتوى",
  description: "منصة إدارة المحتوى والروزنامة — جمعية تأصيل التعليمية",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${qomra.variable} ${sakkal.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-cream-50 text-ink-900">{children}</body>
    </html>
  );
}
