/**
 * Spacing & layout tokens.
 * Named to match Tailwind scale used in the web app.
 */
export const spacing = {
  '0':    0,
  '1':    4,
  '2':    8,
  '3':    12,
  '4':    16,
  '5':    20,
  '6':    24,
  '8':    32,
  '10':   40,
  '12':   48,
  '16':   64,
};

// Semantic aliases used throughout the app
export const space = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
};

/**
 * Border radius tokens.
 * Web uses rounded-[2rem] (32px) for cards, rounded-full for pills/buttons.
 */
export const radius = {
  sm:    10,
  md:    14,
  lg:    18,
  xl:    22,
  '2xl': 26,
  '3xl': 32,   // rounded-[2rem] — main cards, hero sections
  full:  9999, // rounded-full — pills, buttons, badges
};

/**
 * Shadow tokens.
 * Named to match the web shadow- classes.
 */
export const shadows = {
  // shadow-[0_24px_80px_-36px_rgba(13,59,46,0.25)] — hero card
  hero: {
    shadowColor:  '#0D3B2E',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius:  32,
    elevation:     18,
  },
  // shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] — section cards
  card: {
    shadowColor:  '#0D3B2E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius:  24,
    elevation:     10,
  },
  // shadow-[0_10px_24px_rgba(201,162,39,0.22)] — active nav items
  navActive: {
    shadowColor:  '#C9A227',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius:  12,
    elevation:     6,
  },
  // shadow-[0_12px_28px_rgba(45,138,106,0.25)] — primary buttons
  button: {
    shadowColor:  '#2D8A6A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius:  14,
    elevation:     6,
  },
  // shadow-[0_8px_24px_rgba(13,59,46,0.06)] — topbar user pill
  subtle: {
    shadowColor:  '#0D3B2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius:  10,
    elevation:     3,
  },
  // No shadow
  none: {
    shadowColor:   'transparent',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius:  0,
    elevation:     0,
  },
};
