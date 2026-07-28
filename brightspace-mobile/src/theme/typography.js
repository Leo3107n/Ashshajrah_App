/**
 * Typography tokens.
 *
 * Web uses:
 *   - Outfit (via next/font) → closest mobile equivalent is the system sans-serif
 *   - Georgia (serif) for h1/h2 / .font-display headings
 *
 * On mobile we use the system font for body (matches Outfit's clean geometric feel)
 * and Georgia (available on both iOS and Android) for display headings.
 */
export const fonts = {
  display: 'Georgia',    // h1/h2 — serif, matches web font-display
  body:    undefined,    // system default (SF Pro on iOS, Roboto on Android)
};

export const fontSize = {
  '2xs': 10,   // badge / tag text
  xs:    11,   // eyebrow labels (0.65rem → ~10.4px, using 11)
  sm:    13,   // body small, meta text
  base:  15,   // standard body
  md:    16,   // slightly larger body
  lg:    18,   // card titles
  xl:    20,   // section titles
  '2xl': 24,   // h2 equivalent
  '3xl': 28,   // h1 small
  '4xl': 32,   // hero heading
  '5xl': 36,   // large hero heading
  '6xl': 40,   // max heading
};

export const fontWeight = {
  normal:    '400',
  medium:    '500',
  semibold:  '600',
  bold:      '700',
  extrabold: '800',
};

export const letterSpacing = {
  // Mirrors web tracking-[0.24em], tracking-[0.18em] etc. converted to px at ~15px base
  tight:   0.3,
  normal:  0.5,
  wide:    1.5,   // tracking-wide
  wider:   2.4,   // tracking-[0.16em]
  widest:  3.2,   // tracking-[0.22em]
  brand:   4.0,   // tracking-[0.28em] — eyebrow labels
};

export const lineHeight = {
  tight:   1.2,
  snug:    1.35,
  normal:  1.5,
  relaxed: 1.7,
  loose:   1.8,
};
