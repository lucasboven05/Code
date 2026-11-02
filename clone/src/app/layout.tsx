import type { Metadata, Viewport } from 'next';
import './globals.css';
import '../styles/tokens.css';
import { Provider } from '@/components/Provider';

export const metadata: Metadata = { title: 'Practice Invest', description: 'A private practice app for learning to invest with simulated money.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@600;700&display=swap" />
      </head>
      <body><Provider>{children}</Provider></body>
    </html>
  );
}
