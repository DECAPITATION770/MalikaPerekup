// icons.jsx — Lucide-style stroke icons (inline SVGs, no emoji per user request).
// All icons render at 24×24 by default; size override via prop.
// Filled variants for category tiles; outlined for everything else.

const Icon = ({ d, size = 24, stroke = 'currentColor', sw = 1.8, fill = 'none', children, vb = 24, style }) => (
  <svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill={fill} stroke={stroke}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
    {d ? <path d={d}/> : children}
  </svg>
);

// ─── Categories ─────────────────────────────────────────────
const IconPhone = (p) => <Icon {...p}><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><line x1="11" y1="18.5" x2="13" y2="18.5"/></Icon>;
const IconTablet = (p) => <Icon {...p}><rect x="4" y="3" width="16" height="18" rx="2.5"/><line x1="11" y1="18" x2="13" y2="18"/></Icon>;
const IconLaptop = (p) => <Icon {...p}><rect x="3" y="5" width="18" height="11" rx="1.5"/><path d="M2 19h20l-1.5-3h-17z"/></Icon>;
const IconWatch = (p) => <Icon {...p}><rect x="6" y="6" width="12" height="12" rx="2.5"/><path d="M9 6V3h6v3M9 18v3h6v-3"/></Icon>;
const IconHeadphones = (p) => <Icon {...p}><path d="M3 14v-2a9 9 0 0 1 18 0v2"/><path d="M3 14h3v6H4a1 1 0 0 1-1-1zM21 14h-3v6h2a1 1 0 0 0 1-1z"/></Icon>;

// ─── Money / business ───────────────────────────────────────
const IconMoney = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M9 9c0-1.1.9-2 2-2h2a2 2 0 0 1 0 4h-2a2 2 0 0 0 0 4h2c1.1 0 2-.9 2-2M12 5v2M12 17v2"/></Icon>;
const IconBox = (p) => <Icon {...p}><path d="M3 7l9-4 9 4M3 7v10l9 4M3 7l9 4M21 7v10l-9 4M21 7l-9 4M12 11v10"/></Icon>;
const IconSnowflake = (p) => <Icon {...p}><path d="M12 2v20M5 5l14 14M5 19L19 5M2 12h20"/><path d="M9 4l3 1 3-1M9 20l3-1 3 1M4 9l1 3-1 3M20 9l-1 3 1 3"/></Icon>;
const IconClipboard = (p) => <Icon {...p}><rect x="6" y="4" width="12" height="17" rx="2"/><rect x="9" y="2" width="6" height="3.5" rx="1"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/></Icon>;
const IconChart = (p) => <Icon {...p}><path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/></Icon>;
const IconCash = (p) => <Icon {...p}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M5 9v.01M19 15v.01"/></Icon>;
const IconCalendar = (p) => <Icon {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></Icon>;

// ─── Nav / actions ──────────────────────────────────────────
const IconHome = (p) => <Icon {...p}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></Icon>;
const IconSettings = (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></Icon>;
const IconCrown = (p) => <Icon {...p}><path d="M3 7l4 4 5-7 5 7 4-4-2 13H5z"/><circle cx="3" cy="7" r="1"/><circle cx="21" cy="7" r="1"/><circle cx="12" cy="4" r="1"/></Icon>;
const IconSearch = (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></Icon>;
const IconCamera = (p) => <Icon {...p}><path d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="4"/></Icon>;
const IconQr = (p) => <Icon {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14h1M14 20h3v1M20 17v4"/></Icon>;
const IconPlus = (p) => <Icon {...p} d="M12 5v14M5 12h14" />;
const IconCheck = (p) => <Icon {...p} d="M4 12l5 5L20 6" />;
const IconX = (p) => <Icon {...p} d="M6 6l12 12M18 6L6 18" />;
const IconChevR = (p) => <Icon {...p} d="M9 6l6 6-6 6" />;
const IconChevL = (p) => <Icon {...p} d="M15 6l-6 6 6 6" />;
const IconChevD = (p) => <Icon {...p} d="M6 9l6 6 6-6" />;
const IconArrowL = (p) => <Icon {...p} d="M19 12H5M12 19l-7-7 7-7" />;
const IconPhoneCall = (p) => <Icon {...p} d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L7.9 9.7a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2-.5c.9.3 1.8.5 2.7.6A2 2 0 0 1 22 16.9z" />;
const IconBell = (p) => <Icon {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></Icon>;
const IconUser = (p) => <Icon {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></Icon>;
const IconUsers = (p) => <Icon {...p}><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><circle cx="17" cy="6" r="3"/><path d="M22 19a5 5 0 0 0-5-5"/></Icon>;
const IconShield = (p) => <Icon {...p}><path d="M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5z"/></Icon>;
const IconKey = (p) => <Icon {...p}><circle cx="8" cy="14" r="4"/><path d="M11.6 11.6L21 2.2M16 5l3 3M14 7l3 3"/></Icon>;
const IconLogOut = (p) => <Icon {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></Icon>;
const IconStore = (p) => <Icon {...p}><path d="M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 13h6"/></Icon>;
const IconClock = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>;
const IconAlert = (p) => <Icon {...p}><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/></Icon>;
const IconRefund = (p) => <Icon {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></Icon>;
const IconEdit = (p) => <Icon {...p}><path d="M16 3l5 5L8 21H3v-5z"/></Icon>;
const IconTrash = (p) => <Icon {...p}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14"/></Icon>;
const IconPrint = (p) => <Icon {...p}><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></Icon>;
const IconFilter = (p) => <Icon {...p}><path d="M3 4h18l-7 9v6l-4 2v-8z"/></Icon>;
const IconLang = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></Icon>;
const IconHelp = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 4M12 17v.01"/></Icon>;
const IconStar = (p) => <Icon {...p} d="M12 2l3 7 7 .8-5.2 4.8 1.5 7-6.3-3.7L5.7 21.6l1.5-7L2 9.8l7-.8z" />;
const IconMore = (p) => <Icon {...p}><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></Icon>;
const IconUpload = (p) => <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v13"/></Icon>;
const IconImage = (p) => <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></Icon>;

Object.assign(window, {
  Icon,
  IconPhone, IconTablet, IconLaptop, IconWatch, IconHeadphones,
  IconMoney, IconBox, IconSnowflake, IconClipboard, IconChart, IconCash, IconCalendar,
  IconHome, IconSettings, IconCrown, IconSearch, IconCamera, IconQr,
  IconPlus, IconCheck, IconX, IconChevR, IconChevL, IconChevD, IconArrowL,
  IconPhoneCall, IconBell, IconUser, IconUsers, IconShield, IconKey, IconLogOut,
  IconStore, IconClock, IconAlert, IconRefund, IconEdit, IconTrash, IconPrint,
  IconFilter, IconLang, IconHelp, IconStar, IconMore, IconUpload, IconImage,
});
