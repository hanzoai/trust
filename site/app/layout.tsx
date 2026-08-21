import './global.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import { Providers } from './providers';

// Geist is the Hanzo identity's typeface. theme.css reads `--font-geist-*-provided`
// and resolves its own family variables to whatever these bind, so binding them
// here is the whole of the wiring and no component names a family.
const sans = Geist({ subsets: ['latin'], variable: '--geist-sans', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--geist-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Trust — Hanzo',
  description:
    'How Hanzo secures its platform: the control inventory, what each control is, where its mechanism lives, coverage against published frameworks, and the documents, subprocessors and policies behind them.',
  metadataBase: new URL('https://trust.hanzo.ai'),
  openGraph: {
    title: 'Trust — Hanzo',
    description: 'The control inventory, coverage against published frameworks, and the documents behind them.',
    type: 'website',
    siteName: 'Hanzo',
    url: 'https://trust.hanzo.ai',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // Both theme classes are on the server-rendered element, so the FIRST frame
    // is already the dark ground — `dark` is what @hanzo/ui's tokens key off,
    // `t_dark` is what gui resolves `$color…` through. Providers keeps writing
    // them from one state; this is what the reader sees before any of it runs.
    <html lang="en" className={`dark t_dark ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
