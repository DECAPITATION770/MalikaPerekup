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

/** Stable colour for a brand name. */
export function brandColor(brand: string): string {
  let hash = 0;
  for (let i = 0; i < brand.length; i++) {
    hash = (hash * 31 + brand.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
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
