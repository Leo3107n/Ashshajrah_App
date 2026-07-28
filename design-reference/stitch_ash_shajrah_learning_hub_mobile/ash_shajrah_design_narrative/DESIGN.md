---
name: Ash-Shajrah Design Narrative
colors:
  surface: '#fcf9f2'
  surface-dim: '#dcdad3'
  surface-bright: '#fcf9f2'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3ec'
  surface-container: '#f0eee7'
  surface-container-high: '#ebe8e1'
  surface-container-highest: '#e5e2db'
  on-surface: '#1c1c18'
  on-surface-variant: '#404945'
  inverse-surface: '#31312c'
  inverse-on-surface: '#f3f0ea'
  outline: '#707975'
  outline-variant: '#c0c9c4'
  surface-tint: '#366758'
  primary: '#00271e'
  on-primary: '#ffffff'
  primary-container: '#063f32'
  on-primary-container: '#78aa99'
  inverse-primary: '#9dd1bf'
  secondary: '#755b00'
  on-secondary: '#ffffff'
  secondary-container: '#fed255'
  on-secondary-container: '#735a00'
  tertiary: '#00281b'
  on-tertiary: '#ffffff'
  tertiary-container: '#00402d'
  on-tertiary-container: '#58b18e'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b9eedb'
  primary-fixed-dim: '#9dd1bf'
  on-primary-fixed: '#002018'
  on-primary-fixed-variant: '#1c4f41'
  secondary-fixed: '#ffe08e'
  secondary-fixed-dim: '#ecc246'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#584400'
  tertiary-fixed: '#9af4ce'
  tertiary-fixed-dim: '#7fd8b3'
  on-tertiary-fixed: '#002116'
  on-tertiary-fixed-variant: '#00513b'
  background: '#fcf9f2'
  on-background: '#1c1c18'
  surface-variant: '#e5e2db'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-lg:
    fontFamily: Quicksand
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  body-lg:
    fontFamily: Quicksand
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
  body-md:
    fontFamily: Quicksand
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  label-md:
    fontFamily: Quicksand
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Quicksand
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  container-padding-mobile: 20px
  container-padding-desktop: 40px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The design system is anchored in the concept of "The Tree" (Ash-Shajrah), symbolizing growth, deep roots, and sheltering shade. It targets a premium educational demographic, prioritizing a nurturing, organic, and sophisticated atmosphere. 

The aesthetic direction blends **Minimalism** with **Tactile** elements. It utilizes generous whitespace and a restricted, nature-inspired palette to reduce cognitive load while employing soft, rounded surfaces and subtle green-tinted elevations to create a sense of physical safety and premium craftsmanship. The emotional response should be one of calm focus, academic prestige, and welcoming warmth.

## Colors

This color palette is designed to evoke a "sanctuary of learning." 

- **Primary & Deep Tones:** #063F32 and #0D3B2E are reserved for high-level branding, primary navigation backgrounds, and deep emphasis to provide a grounded, authoritative foundation.
- **Accents:** Gold (#C9A227) is used sparingly for call-to-actions, achievement markers, and "active" indicators to provide a premium contrast against the emerald base.
- **Backgrounds:** The primary interface uses a warm Cream (#FAF7F0) rather than pure white to reduce eye strain and enhance the nurturing feel. Surfaces use #FCFAF5 to create subtle layered distinction.
- **Translucency:** Emerald borders should be applied at 10-15% opacity to create soft structure without harsh lines.

## Typography

The typographic system utilizes a "High-Contrast Pairing" strategy. 

- **Headlines:** Playfair Display provides a literary, authoritative voice. Use it for page titles, module headers, and large quotes. It should always appear in Deep Emerald (#063F32).
- **Body & UI:** Quicksand brings an approachable, human-centric clarity. Its rounded terminals mirror the "organic" shape language of the design system. 
- **Hierarchy:** Maintain clear distinction by using weight rather than just size; for example, labels should use Bold or SemiBold weights in Secondary Text (#245C4F) to ensure legibility against the cream backgrounds.

## Layout & Spacing

The design system employs a **Fluid-Fixed Hybrid Grid**. 
- **Mobile:** A 4-column layout with 20px side margins and 16px gutters.
- **Desktop:** A 12-column centered layout with a maximum content width of 1200px.

Spacing follows a 4px base unit. Vertical rhythm is critical for readability in an educational context; use `stack-lg` (32px) between major content sections and `stack-sm` (8px) for grouping related elements like an input field and its label. All interactive targets must maintain a minimum height of 44px to ensure accessibility for all age groups.

## Elevation & Depth

This design system avoids harsh black shadows in favor of **Organic Tonal Depth**. 

Hierarchy is established using "Emerald-Tinted Shadows." Shadows should use the Primary Color (#063F32) at very low opacities (e.g., 4-8%) with a large blur radius to simulate a soft glow. 

- **Level 0 (Base):** Cream background (#FAF7F0).
- **Level 1 (Cards):** Surface color (#FCFAF5) with a 1px border of #0D5C48 at 10% opacity.
- **Level 2 (Interactive/Floating):** Surface color with a soft 12px blur shadow tinted with Emerald.
- **Level 3 (Modals/Bottom Sheets):** Maximum elevation with a 24px blur shadow and a subtle Deep Emerald to Medium Emerald gradient header.

## Shapes

The shape language is defined by **Generous Radii**. 
- **Standard Cards:** Use 24px corner radii to create a friendly, modern container.
- **Interactive Elements:** Buttons and chips are fully pill-shaped (radius: 999px) to signify actionability and provide a distinct contrast to the rectangular card containers.
- **Form Inputs:** Use a 12px radius to balance the softness of the cards with the precision required for data entry.

## Components

### Buttons & Navigation
- **Primary Action:** Pill-shaped, using a gradient from #063F32 to #0D5C48 with White text.
- **Secondary Action:** Pill-shaped, Gold (#C9A227) background or 2px Gold outline with Gold text.
- **Bottom Navigation:** Fixed to the bottom of the screen with a slight blur backdrop; active states are indicated by a Gold icon and a small dot indicator.

### Cards & Lists
- **Stat Cards:** Compact 24px rounded containers. Use Pale Gold (#FFF5D6) backgrounds for highlighted metrics.
- **Class/Homework Cards:** Vertical orientation. Left-side color strip indicates status (Success/Green, Warning/Gold, Error/Red). Title in Playfair Display, metadata in Quicksand.

### Inputs & Selection
- **Input Fields:** 12px rounded corners, Cream background, and a 1px Light Emerald border that thickens to 2px Gold on focus.
- **Chips:** Pill-shaped, small (32px height), using Medium Emerald at 10% opacity for inactive states and solid Gold for active/selected states.

### Overlays
- **Bottom Sheets:** Use a 28px top-corner radius. Include a small, rounded "drag handle" at the top in a neutral gray-green tint.