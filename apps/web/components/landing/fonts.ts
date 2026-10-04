import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';

/**
 * The public face of KnowGuard (landing and sign-in pages): Bricolage Grotesque for display,
 * Instrument Sans for reading. Self-hosted at build time by next/font, so the CSP stays closed.
 */
export const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
});
export const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', display: 'swap' });

export const PUBLIC_FONTS = `${display.variable} ${body.variable} font-body`;
