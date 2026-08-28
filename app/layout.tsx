import './globals.css';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans text-ink antialiased bg-canvas bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(0,113,227,0.06),transparent)] min-h-screen">
        {children}
      </body>
    </html>
  );
}
