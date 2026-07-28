/**
 * Color tokens — exact values from globals.css and web components.
 * Every hex here matches what the web app uses.
 */
export const colors = {
  // ── Brand greens ─────────────────────────────────────
  emeraldDeep:  '#0D3B2E',   // sidebar gradient start, dark hero bg
  emeraldDark:  '#063F32',   // primary text, page foreground
  emerald:      '#1A5C45',   // primary button bg
  emeraldMid:   '#0D5C48',   // section eyebrow text, muted icons
  emeraldLight: '#2D8A6A',   // borders, icon accents, focus rings

  // ── Gold accents ──────────────────────────────────────
  gold:         '#C9A227',   // active nav item gradient start
  goldLight:    '#E4C766',   // active nav item gradient end
  goldPale:     '#FFF5D6',   // active icon background, gold tint bg
  goldSoft:     '#E8D5A3',   // soft gold text backgrounds

  // ── Cream / warm neutrals ─────────────────────────────
  cream:        '#FAF7F0',   // app background (--background)
  creamDark:    '#F0EBE0',   // --color-cream-dark
  parchment:    '#F1EADC',   // scrollbar track, table header bg
  parchmentLight: '#FCFAF5', // inner card bg
  warmBrown:    '#5C4A32',   // --color-warm-brown

  // ── Text ──────────────────────────────────────────────
  textPrimary:   '#063F32',  // headings, primary content
  textSecondary: '#245C4F',  // body text, meta labels
  textMuted:     '#0D5C48',  // eyebrow / uppercase labels
  textOnDark:    '#FAF7F0',  // text on green/dark backgrounds
  textGold:      '#F7EFCF',  // gold text on dark bg
  textGoldDim:   '#F3EEDB',  // dimmed gold text

  // ── Borders ───────────────────────────────────────────
  borderGreen:       'rgba(45,138,106,0.15)',
  borderGreenStrong: 'rgba(45,138,106,0.20)',
  borderDark:        'rgba(13,59,46,0.12)',
  borderWhite:       'rgba(255,255,255,0.10)',

  // ── Status — lectures ─────────────────────────────────
  statusLiveBg:        '#DCFCE7',
  statusLiveText:      '#15803D',
  statusUpcomingBg:    '#FFF5D6',
  statusUpcomingText:  '#A16207',
  statusEndedBg:       '#F1F5F9',
  statusEndedText:     '#475569',
  statusCompletedBg:   '#D1FAE5',
  statusCompletedText: '#0D5C48',
  statusVerifiedBg:    '#D1FAE5',
  statusVerifiedText:  '#063F32',
  statusMissedBg:      '#FEE2E2',
  statusMissedText:    '#DC2626',
  statusCancelledBg:   '#F3F4F6',
  statusCancelledText: '#6B7280',
  statusDisputedBg:    '#FFEDD5',
  statusDisputedText:  '#C2410C',
  statusScheduledBg:   '#E0F2FE',
  statusScheduledText: '#0369A1',

  // ── Status — payments / homework ──────────────────────
  statusUnpaidBg:      '#FEE2E2',
  statusUnpaidText:    '#DC2626',
  statusSubmittedBg:   '#FEF3C7',
  statusSubmittedText: '#92400E',
  statusRejectedBg:    '#FEE2E2',
  statusRejectedText:  '#DC2626',
  statusPendingBg:     '#FEF3C7',
  statusPendingText:   '#92400E',
  statusApprovedBg:    '#D1FAE5',
  statusApprovedText:  '#059669',

  // ── Status — attendance ───────────────────────────────
  statusPresentBg:     '#D1FAE5',
  statusPresentText:   '#059669',
  statusAbsentBg:      '#FEE2E2',
  statusAbsentText:    '#DC2626',
  statusPartialBg:     '#FEF3C7',
  statusPartialText:   '#92400E',

  // ── Alerts ────────────────────────────────────────────
  roseBg:     '#FFF1F2',
  roseBorder: '#FECDD3',
  roseText:   '#BE123C',
  roseDeep:   '#BF2106',

  // ── Base ──────────────────────────────────────────────
  white:       '#FFFFFF',
  black:       '#000000',
  transparent: 'transparent',
};

/**
 * Gradient definitions matching the web linear-gradient values.
 * Used with react-native-linear-gradient or as plain background fallbacks.
 */
export const gradients = {
  // Sidebar: bg-[linear-gradient(180deg,#0D3B2E_0%,#063F32_100%)]
  sidebar:    ['#0D3B2E', '#063F32'],

  // Hero sections: bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))]
  hero:       ['rgba(13,59,46,0.98)', 'rgba(13,92,72,0.94)'],

  // Card bg: bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)]
  card:       ['rgba(255,255,255,0.96)', 'rgba(250,247,240,0.98)'],

  // Active nav item: bg-[linear-gradient(135deg,#C9A227_0%,#E4C766_100%)]
  navActive:  ['#C9A227', '#E4C766'],

  // Primary button: bg-[linear-gradient(135deg,#0D5C48_0%,#2D8A6A_55%,#C9A227_160%)]
  button:     ['#0D5C48', '#2D8A6A'],

  // Page background: bg-[linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]
  pageBg:     ['#FAF7F0', '#F7F1E3'],

  // Login left panel: bg-[linear-gradient(135deg,_#063F32_0%,_#0D5C48_45%,_#236B51_100%)]
  loginPanel: ['#063F32', '#0D5C48', '#236B51'],
};
