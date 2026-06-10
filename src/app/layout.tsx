import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Self-hosted via next/font: no render-blocking request, `display: swap` avoids FOIT,
// and the font files are preloaded — together these protect LCP and CLS.
const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
  display: 'swap',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'DevPulse — Developer Trend Intelligence', template: '%s · DevPulse' },
  description:
    'DevPulse aggregates GitHub and Hacker News in real time and computes a unified momentum score so engineers can see which technologies are gaining traction.',
  metadataBase: new URL('https://devpulse.app'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen`}>{children}</body>
    </html>
  );
}
