// tokens.jsx — Malika design tokens
// Colors, type scale, status palette, accent options. Read by all screen files.

const MALIKA = {
  // Type stack (system, no web fonts per spec)
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, system-ui, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',

  // Status palette (shared dark/light, slightly tuned)
  // Saturations kept moderate — high contrast on bright sun without being neon
  status: {
    green: { bg: '#0F3F2A', border: '#1F6E48', text: '#3DDC97', solid: '#22C28E' },
    yellow:{ bg: '#3F2F0A', border: '#7A5C18', text: '#F2C552', solid: '#E0AA2F' },
    blue:  { bg: '#0E2A4A', border: '#1F4F86', text: '#5AB0FF', solid: '#3B8FE0' },
    red:   { bg: '#3D1414', border: '#7A2828', text: '#F26E5E', solid: '#DC4F3F' },
    gray:  { bg: '#222428', border: '#3A3D43', text: '#9AA0A8', solid: '#6A6F77' },
  },
  statusLight: {
    green: { bg: '#E6F6EE', border: '#9DD6B8', text: '#0E6A45', solid: '#0E9963' },
    yellow:{ bg: '#FBF1D6', border: '#E5C97A', text: '#7A5A0F', solid: '#B5870C' },
    blue:  { bg: '#E1EEFB', border: '#9CC5EE', text: '#0F4A85', solid: '#1F6FC9' },
    red:   { bg: '#FAE3E0', border: '#E59B91', text: '#86251A', solid: '#C9382A' },
    gray:  { bg: '#EEEFF1', border: '#CDD0D5', text: '#5C6068', solid: '#7A7F87' },
  },
};

// Accent palettes (Telegram button color). Hue varies; chroma similar.
const ACCENTS = {
  telegram: { solid: '#2AABEE', hover: '#1E96D2', faded: '#0E2A3A', name: 'Telegram' },
  blue:     { solid: '#3B82F6', hover: '#2D69D5', faded: '#0F1F3D', name: 'Blue' },
  green:    { solid: '#10B981', hover: '#0E9C6E', faded: '#0F2C25', name: 'Green' },
  amber:    { solid: '#F59E0B', hover: '#D88808', faded: '#3A2A09', name: 'Amber' },
};

// Theme tokens (mimics Telegram WebApp CSS vars)
function makeTheme(dark, accentKey = 'telegram') {
  const a = ACCENTS[accentKey] || ACCENTS.telegram;
  if (dark) return {
    name: 'dark',
    bg:        '#17191C',         // tg-theme-bg
    bg2:       '#1F2226',         // tg-theme-secondary-bg
    bg3:       '#272A2F',         // raised cards
    text:      '#F2F4F7',
    textDim:   '#9AA0A8',
    textMuted: '#6A6F77',
    hint:      '#7A8088',
    border:    '#2D3036',
    borderStrong: '#3A3E45',
    accent:    a.solid,
    accentHover: a.hover,
    accentFaded: a.faded,
    onAccent:  '#FFFFFF',
    danger:    '#F26E5E',
    success:   '#3DDC97',
    warning:   '#F2C552',
    status:    MALIKA.status,
  };
  return {
    name: 'light',
    bg:        '#FFFFFF',
    bg2:       '#F4F5F7',
    bg3:       '#FFFFFF',
    text:      '#0F1115',
    textDim:   '#525864',
    textMuted: '#80858F',
    hint:      '#80858F',
    border:    '#E4E6EA',
    borderStrong: '#CCD0D6',
    accent:    a.solid,
    accentHover: a.hover,
    accentFaded: '#E1EEFB',
    onAccent:  '#FFFFFF',
    danger:    '#DC4F3F',
    success:   '#0E9963',
    warning:   '#B5870C',
    status:    MALIKA.statusLight,
  };
}

// Density — controls vertical rhythm
const DENSITIES = {
  roomy:    { row: 64, gap: 16, pad: 20, card: 18 },
  balanced: { row: 56, gap: 12, pad: 16, card: 14 },
  dense:    { row: 48, gap: 8,  pad: 12, card: 10 },
};

Object.assign(window, { MALIKA, ACCENTS, makeTheme, DENSITIES });
