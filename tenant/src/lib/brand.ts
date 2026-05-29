// Deterministic brand colours — same brand maps to the same colour
// everywhere (lists, cards, pickers). No copyrighted logos: a colour + the
// brand's letter is identity enough and scales to any brand the shop types.

/** Vivid inks that all clear WCAG AA on the dark surfaces. */
const PALETTE = [
  '#E89A2E', // amber (house accent)
  '#5B9BD5', // blue
  '#42C28E', // green
  '#E0607E', // pink
  '#9B7BE8', // violet
  '#46C3D0', // cyan
  '#7FB069', // olive
  '#D98C5F', // terracotta
  '#C77DCB', // orchid
  '#5FB0E8', // sky
];

/**
 * Darker mirrors of the same hues — used as *text* color on the tinted
 * chip background in light mode. The vivid PALETTE looks great on dark
 * surfaces but pairs the chip text with its own pale tint on light bg
 * (ratio ~2.4, axe-core "color-contrast" fail). These shades all clear
 * WCAG AA (≥4.5:1) on the light bg2 used for chips.
 */
const PALETTE_ON_LIGHT = [
  '#8A5A12', // amber
  '#1F5F94', // blue
  '#177451', // green
  '#A5294A', // pink
  '#4929A6', // violet
  '#0E6B78', // cyan
  '#3D6326', // olive
  '#8C4520', // terracotta
  '#7A2E80', // orchid
  '#1A5E91', // sky
];

function indexFor(brand: string): number {
  let hash = 0;
  for (let i = 0; i < brand.length; i++) {
    hash = (hash * 31 + brand.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % PALETTE.length;
}

/** Stable vivid colour for a brand name — for backgrounds, avatars, accents. */
export function brandColor(brand: string): string {
  return PALETTE[indexFor(brand)];
}

/**
 * Theme-aware text colour for the chip body. Pass `resolved` from
 * `useTheme()`; light mode uses the darker mirror, dark mode uses the
 * vivid hex so the chip keeps its identity on the dark surface.
 */
export function brandTextColor(brand: string, resolved: 'light' | 'dark'): string {
  return resolved === 'light' ? PALETTE_ON_LIGHT[indexFor(brand)] : PALETTE[indexFor(brand)];
}

/** Faded fill of a brand's colour — for avatar tiles / soft backgrounds. */
export function brandTint(brand: string, alpha: number): string {
  const hex = brandColor(brand);
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
