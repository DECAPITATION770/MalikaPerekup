// ui.jsx — Shared UI primitives for Malika.
// Button, Card, StatusBadge, TopBar, BottomNav, Field, Chip, Tile, ProgressBar, MoneyText, Avatar.

const { IconSearch, IconCamera, IconArrowL, IconMore, IconHome, IconBox, IconCash,
  IconChart, IconSettings, IconCrown, IconChevR, IconAlert, IconCheck, IconClock,
  IconPhone, IconTablet, IconLaptop, IconWatch, IconHeadphones } = window;

// ─── Money formatting (RU locale w/ NBSPs) ─────────────────
function fmtUZS(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F') + '\u00A0сум';
}
function fmtUSD(n) { return '$' + n.toFixed(2); }
function fmtSigned(n) {
  const sign = n >= 0 ? '+' : '\u2212';
  return sign + fmtUZS(Math.abs(n));
}

// ─── Button ─────────────────────────────────────────────────
const Button = ({ children, theme, variant = 'primary', size = 'md', icon, full, onClick, style, danger }) => {
  const base = {
    fontFamily: 'inherit', fontWeight: 600,
    borderRadius: 12, border: 'none', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: full ? '100%' : undefined,
    transition: 'background .12s, transform .08s',
    letterSpacing: -0.1,
  };
  const sizes = {
    sm: { height: 36, padding: '0 14px', fontSize: 14 },
    md: { height: 48, padding: '0 18px', fontSize: 16 },
    lg: { height: 56, padding: '0 22px', fontSize: 17 },
  };
  let look;
  if (danger) {
    look = variant === 'primary'
      ? { background: theme.danger, color: '#fff' }
      : { background: 'transparent', color: theme.danger, boxShadow: `inset 0 0 0 1.5px ${theme.danger}` };
  } else if (variant === 'primary') {
    look = { background: theme.accent, color: theme.onAccent };
  } else if (variant === 'secondary') {
    look = { background: theme.bg2, color: theme.text, boxShadow: `inset 0 0 0 1px ${theme.border}` };
  } else if (variant === 'ghost') {
    look = { background: 'transparent', color: theme.accent };
  } else if (variant === 'outline') {
    look = { background: 'transparent', color: theme.text, boxShadow: `inset 0 0 0 1.5px ${theme.borderStrong}` };
  }
  return (
    <button onClick={onClick} style={{ ...base, ...sizes[size], ...look, ...style }}>
      {icon}{children}
    </button>
  );
};

// ─── Card ───────────────────────────────────────────────────
const Card = ({ theme, children, padding = 16, style, onClick, raised }) => (
  <div onClick={onClick} style={{
    background: theme.bg3, borderRadius: 16, padding,
    border: `1px solid ${theme.border}`,
    boxShadow: raised ? '0 1px 2px rgba(0,0,0,.04), 0 6px 16px rgba(0,0,0,.04)' : 'none',
    cursor: onClick ? 'pointer' : 'default',
    ...style,
  }}>{children}</div>
);

// ─── Status badge ───────────────────────────────────────────
const StatusBadge = ({ theme, kind = 'green', children, dot, size = 'md' }) => {
  const c = theme.status[kind];
  const padding = size === 'sm' ? '2px 8px' : '4px 10px';
  const fs = size === 'sm' ? 12 : 13;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding, borderRadius: 999, fontSize: fs, fontWeight: 600,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      letterSpacing: -0.05, whiteSpace: 'nowrap',
    }}>
      {dot && <span style={{ width: 7, height: 7, borderRadius: 7, background: c.solid }}/>}
      {children}
    </span>
  );
};

// ─── Field (input + label) ──────────────────────────────────
const Field = ({ theme, label, value, hint, suffix, prefix, mono, big, error, multiline }) => {
  const Tag = multiline ? 'div' : 'div';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label style={{ fontSize: 13, color: theme.textDim, fontWeight: 500, letterSpacing: -0.05 }}>{label}</label>}
      <div style={{
        display: 'flex', alignItems: multiline ? 'stretch' : 'center', gap: 8,
        background: theme.bg2, borderRadius: 12,
        border: `1px solid ${error ? theme.danger : theme.border}`,
        padding: multiline ? 12 : '0 14px',
        height: multiline ? undefined : (big ? 56 : 48),
        minHeight: multiline ? 80 : undefined,
      }}>
        {prefix && <span style={{ color: theme.textDim, fontSize: 15 }}>{prefix}</span>}
        <span style={{
          flex: 1, color: theme.text,
          fontSize: big ? 22 : 16, fontWeight: big ? 600 : 500,
          fontFamily: mono ? window.MALIKA.mono : 'inherit',
          letterSpacing: mono ? 0.3 : -0.1,
        }}>{value}</span>
        {suffix && <span style={{ color: theme.textDim, fontSize: 14 }}>{suffix}</span>}
      </div>
      {hint && <span style={{ fontSize: 12, color: theme.textMuted }}>{hint}</span>}
    </div>
  );
};

// ─── Chip (multi-state selectable) ──────────────────────────
const Chip = ({ theme, active, children, onClick, danger }) => (
  <button onClick={onClick} style={{
    fontFamily: 'inherit', fontWeight: 600, fontSize: 14, letterSpacing: -0.05,
    padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
    background: active ? (danger ? theme.danger : theme.accent) : theme.bg2,
    color: active ? theme.onAccent : theme.text,
    border: `1px solid ${active ? 'transparent' : theme.border}`,
  }}>{children}</button>
);

// ─── Category tile (large, for + Купил form) ───────────────
const CategoryTile = ({ theme, icon, label, active, onClick }) => (
  <button onClick={onClick} style={{
    fontFamily: 'inherit', cursor: 'pointer',
    background: active ? theme.accentFaded : theme.bg2,
    border: `1.5px solid ${active ? theme.accent : theme.border}`,
    borderRadius: 16, padding: 16,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    color: active ? theme.accent : theme.text,
    aspectRatio: '1', minHeight: 88,
  }}>
    {icon}
    <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.05 }}>{label}</span>
  </button>
);

// ─── Top bar (used inside iOS frame) ───────────────────────
const TopBar = ({ theme, title, onBack, right, sub }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '54px 14px 12px',
    background: theme.bg, position: 'sticky', top: 0, zIndex: 10,
    borderBottom: `1px solid ${theme.border}`,
  }}>
    {onBack && (
      <button style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'transparent', color: theme.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <IconArrowL size={22}/>
      </button>
    )}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: theme.text, letterSpacing: -0.3, lineHeight: 1.15 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: theme.textDim, marginTop: 2 }}>{sub}</div>}
    </div>
    {right}
  </div>
);

// ─── Bottom nav ────────────────────────────────────────────
const BottomNav = ({ theme, active = 'home', isAdmin = false, lang = 'ru' }) => {
  const labels = lang === 'uz'
    ? { home: 'Bugun', stock: "Vitrina", nasiya: 'Nasiya', reports: 'Hisobot', settings: 'Sozlama', admin: 'Admin' }
    : { home: 'Сегодня', stock: 'Витрина', nasiya: 'Nasiya', reports: 'Отчёты', settings: 'Настр.', admin: 'Админ' };
  const items = [
    { k: 'home', I: IconHome, l: labels.home },
    { k: 'stock', I: IconBox, l: labels.stock },
    { k: 'nasiya', I: IconCash, l: labels.nasiya },
    { k: 'reports', I: IconChart, l: labels.reports },
    { k: 'settings', I: IconSettings, l: labels.settings },
  ];
  if (isAdmin) items.push({ k: 'admin', I: IconCrown, l: labels.admin });
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-around', alignItems: 'stretch',
      padding: '8px 4px 26px', background: theme.bg,
      borderTop: `1px solid ${theme.border}`,
      position: 'sticky', bottom: 0,
    }}>
      {items.map(({ k, I, l }) => {
        const on = k === active;
        return (
          <div key={k} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            color: on ? theme.accent : theme.textDim, padding: '4px 4px',
            flex: 1, minWidth: 0,
          }}>
            <I size={22} sw={on ? 2.2 : 1.7}/>
            <span style={{ fontSize: 10, fontWeight: on ? 700 : 500, letterSpacing: -0.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{l}</span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Progress bar ──────────────────────────────────────────
const ProgressBar = ({ theme, value, max = 100, kind = 'green', height = 6 }) => {
  const c = theme.status[kind];
  return (
    <div style={{ height, background: theme.bg2, borderRadius: height, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${(value/max)*100}%`, background: c.solid, borderRadius: height }}/>
    </div>
  );
};

// ─── Avatar ────────────────────────────────────────────────
const Avatar = ({ initials, size = 36, color = '#3B82F6', dark }) => (
  <div style={{
    width: size, height: size, borderRadius: size, flexShrink: 0,
    background: color, color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.4, fontWeight: 700, letterSpacing: 0,
  }}>{initials}</div>
);

// ─── DeviceIcon — chooses icon by category ────────────────
const DeviceIcon = ({ category, size = 24 }) => {
  const map = { phone: IconPhone, tablet: IconTablet, laptop: IconLaptop, watch: IconWatch, headphones: IconHeadphones };
  const I = map[category] || IconPhone;
  return <I size={size} sw={1.7} />;
};

// ─── Section title (small caps style) ──────────────────────
const SectionTitle = ({ theme, children, right }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 16px', marginTop: 8, marginBottom: 8 }}>
    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: theme.textDim }}>{children}</span>
    {right}
  </div>
);

// ─── Phone screen container (fills frame) ─────────────────
const Screen = ({ theme, children, scroll = true, pad = 0 }) => (
  <div style={{
    height: '100%', width: '100%',
    background: theme.bg, color: theme.text,
    fontFamily: window.MALIKA.font,
    display: 'flex', flexDirection: 'column',
    overflow: scroll ? 'hidden' : 'visible',
    fontSize: 15, letterSpacing: -0.1,
  }}>{children}</div>
);

Object.assign(window, {
  fmtUZS, fmtUSD, fmtSigned,
  Button, Card, StatusBadge, Field, Chip, CategoryTile, TopBar, BottomNav,
  ProgressBar, Avatar, DeviceIcon, SectionTitle, Screen,
});
