import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '16STORE — Heritage Sneaker Consignment',
  description: 'Sàn ký gửi sneaker được verify · Hà Nội · TP.HCM · Đà Nẵng · Cần Thơ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Archivo+Black&family=Inter:wght@300;400;500;600&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}