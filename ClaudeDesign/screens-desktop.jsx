// screens-desktop.jsx — Telegram Desktop / wide admin views (1024px)
// Sidebar nav on the left + content area on the right.
// Reuses the same data & visual language as the mobile admin screens.

const { Card, StatusBadge, Button, Chip, fmtUZS, Avatar } = window;
const {
  IconSearch, IconPlus, IconStore, IconKey, IconCheck, IconX,
  IconCrown, IconChart, IconUsers, IconShield, IconPhoneCall,
  IconClipboard, IconClock, IconChevR, IconMore, IconFilter,
  IconHome, IconBox, IconCash, IconSnowflake, IconBell,
} = window;

// ─────────────────────────────────────────────────────────────
// Shell — sidebar + topbar + content. All desktop screens nest in this.
// ─────────────────────────────────────────────────────────────
function DesktopShell({ theme, lang, active, title, sub, action, children }) {
  const navItems = [
    { id: 'shops',  icon: IconStore,     ru: 'Магазины',         uz: "Do'konlar" },
    { id: 'create', icon: IconPlus,      ru: 'Создать магазин',  uz: "Yangi do'kon" },
    { id: 'log',    icon: IconShield,    ru: 'Журнал входов',    uz: "Kirish jurnali" },
    { id: 'debts',  icon: IconClipboard, ru: 'Долги Nasiya',     uz: 'Nasiya qarzlari' },
    { id: 'stats',  icon: IconChart,     ru: 'Статистика',       uz: 'Statistika' },
  ];
  return (
    <div style={{
      width: '100%', height: '100%', background: theme.bg, color: theme.text,
      fontFamily: window.MALIKA.font, display: 'flex', overflow: 'hidden',
    }}>
      {/* ── Sidebar ──────────────────────────────────────── */}
      <aside style={{
        width: 232, flexShrink: 0, borderRight: `1px solid ${theme.border}`,
        background: theme.bg2, display: 'flex', flexDirection: 'column',
      }}>
        {/* Brand */}
        <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 11, borderBottom: `1px solid ${theme.border}` }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, background: theme.accent, color: theme.onAccent,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 17, letterSpacing: -0.5,
          }}>M</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2 }}>Malika</div>
            <div style={{ fontSize: 11, color: theme.textDim, display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconCrown size={11}/> Admin
            </div>
          </div>
        </div>
        {/* Nav */}
        <nav style={{ padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          {navItems.map((n) => {
            const isActive = n.id === active;
            const Ic = n.icon;
            return (
              <div key={n.id} style={{
                display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px',
                borderRadius: 8, cursor: 'pointer',
                background: isActive ? theme.accentFaded : 'transparent',
                color: isActive ? theme.accent : theme.text,
                fontSize: 13, fontWeight: isActive ? 600 : 500,
              }}>
                <Ic size={18} stroke="currentColor"/>
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lang === 'uz' ? n.uz : n.ru}</span>
                {n.id === 'log' && <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 9,
                  background: theme.status.red.bg, color: theme.status.red.text,
                }}>3</span>}
                {n.id === 'debts' && <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 9,
                  background: theme.status.red.bg, color: theme.status.red.text,
                }}>23</span>}
              </div>
            );
          })}
        </nav>
        {/* Profile pinned bottom */}
        <div style={{ padding: 12, borderTop: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar initials="МА" color="#3B82F6" size={32}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@malika_admin</div>
            <div style={{ fontSize: 10, color: theme.textDim }}>{lang==='uz'?'Onlayn':'Онлайн'}</div>
          </div>
          <button style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: theme.textDim, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconMore size={16}/>
          </button>
        </div>
      </aside>

      {/* ── Main column ──────────────────────────────────── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar */}
        <header style={{
          height: 60, padding: '0 24px', borderBottom: `1px solid ${theme.border}`,
          display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.2, lineHeight: 1.1 }}>{title}</div>
            {sub && <div style={{ fontSize: 12, color: theme.textDim, marginTop: 2 }}>{sub}</div>}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, background: theme.bg2,
            borderRadius: 10, padding: '0 12px', height: 36, width: 280,
            border: `1px solid ${theme.border}`,
          }}>
            <IconSearch size={16} stroke={theme.textDim}/>
            <span style={{ flex: 1, color: theme.textMuted, fontSize: 13 }}>
              {lang==='uz'?'Qidiruv...':'Поиск...'}
            </span>
            <span style={{ fontSize: 10, color: theme.textMuted, background: theme.bg3, padding: '2px 6px', borderRadius: 4, fontFamily: window.MALIKA.mono, border: `1px solid ${theme.border}` }}>⌘K</span>
          </div>
          <button style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.bg2, color: theme.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconBell size={18}/>
          </button>
          {action}
        </header>
        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', background: theme.bg }}>
          {children}
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// D1. МАГАЗИНЫ — таблица
// ─────────────────────────────────────────────────────────────
function ScreenDesktopShopsFull({ theme, lang }) {
  const t = lang === 'uz' ? {
    title: "Do'konlar", sub: "47 ta · 42 faol", create: "Yangi",
    name: "Nom", owner: 'Egasi', tg: 'Telegram', phone: 'Telefon',
    plan: 'Reja', status: 'Holati', joined: "Ro'yxatdan",
    all: 'Barchasi', active: 'Faol', frozen: 'Muzlatilgan', trial: 'Trial',
  } : {
    title: 'Магазины', sub: '47 точек · 42 активны', create: 'Создать магазин',
    name: 'Название', owner: 'Владелец', tg: 'Telegram', phone: 'Телефон',
    plan: 'План', status: 'Статус', joined: 'Регистрация',
    all: 'Все', active: 'Активные', frozen: 'Замороженные', trial: 'Trial',
  };
  const shops = [
    { name: 'Malika Точка 14', owner: 'Алишер Турсунов', tg: '@alisher_t', phone: '+998 90 123 45 67', plan: 'Pro', status: 'active', joined: '15.04.2025', initials: 'АТ', color: '#10B981' },
    { name: 'Malika Точка 7',  owner: 'Жасур Каримов',   tg: '@jasur_k',   phone: '+998 91 234 56 78', plan: 'Pro', status: 'active', joined: '02.06.2025', initials: 'ЖК', color: '#F59E0B' },
    { name: 'Malika Точка 22', owner: 'Бахром Юсупов',   tg: '@bahrom_y',  phone: '+998 93 456 78 90', plan: 'Trial', status: 'active', joined: '12.04.2026', initials: 'БЮ', color: '#3B82F6' },
    { name: 'Malika Точка 3',  owner: 'Шохрух Назаров',  tg: '@shokh_n',   phone: '+998 94 567 89 01', plan: 'Lite', status: 'frozen', joined: '20.01.2025', initials: 'ШН', color: '#6A6F77' },
    { name: 'Malika Точка 31', owner: 'Дилшод Ахмедов',  tg: '@dilshod_a', phone: '+998 97 678 90 12', plan: 'Pro', status: 'active', joined: '10.09.2025', initials: 'ДА', color: '#DC4F3F' },
    { name: 'Malika Точка 8',  owner: 'Рустам Холматов', tg: '@rustam_kh', phone: '+998 99 789 01 23', plan: 'Lite', status: 'active', joined: '03.11.2025', initials: 'РХ', color: '#0E9963' },
    { name: 'Malika Точка 19', owner: 'Сардор Алиев',    tg: '@sardor_a',  phone: '+998 90 111 22 33', plan: 'Pro', status: 'active', joined: '14.02.2026', initials: 'СА', color: '#7C3AED' },
    { name: 'Malika Точка 11', owner: 'Мирзо Каримов',   tg: '@mirzo_k',   phone: '+998 91 222 33 44', plan: 'Pro', status: 'active', joined: '08.07.2025', initials: 'МК', color: '#0E9963' },
    { name: 'Malika Точка 27', owner: 'Бекзод Юсупов',   tg: '@bekzod_y',  phone: '+998 93 555 66 77', plan: 'Trial', status: 'active', joined: '20.04.2026', initials: 'БЮ', color: '#F59E0B' },
  ];
  const action = (
    <Button theme={theme} size="md" icon={<IconPlus size={18}/>}>{t.create}</Button>
  );
  return (
    <DesktopShell theme={theme} lang={lang} active="shops" title={t.title} sub={t.sub} action={action}>
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Filters bar */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip theme={theme} active>{t.all} · 47</Chip>
          <Chip theme={theme}>{t.active} · 42</Chip>
          <Chip theme={theme}>{t.frozen} · 5</Chip>
          <Chip theme={theme}>{t.trial} · 12</Chip>
          <div style={{ flex: 1 }}/>
          <button style={{ padding: '0 12px', height: 32, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.bg2, color: theme.text, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: 'inherit' }}>
            <IconFilter size={14}/> {lang==='uz'?'Filtrlar':'Фильтры'}
          </button>
        </div>

        {/* Table */}
        <div style={{ background: theme.bg3, borderRadius: 12, border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '40px 2fr 1.8fr 1.2fr 1.4fr 0.8fr 1fr 1fr 40px',
            gap: 14, padding: '12px 18px', background: theme.bg2, borderBottom: `1px solid ${theme.border}`,
            fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: theme.textDim,
          }}>
            <span></span><span>{t.name}</span><span>{t.owner}</span><span>{t.tg}</span><span>{t.phone}</span><span>{t.plan}</span><span>{t.status}</span><span>{t.joined}</span><span></span>
          </div>
          {shops.map((s, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '40px 2fr 1.8fr 1.2fr 1.4fr 0.8fr 1fr 1fr 40px',
              gap: 14, padding: '14px 18px',
              borderBottom: i<shops.length-1?`1px solid ${theme.border}`:'none',
              alignItems: 'center', fontSize: 13,
            }}>
              <Avatar initials={s.initials} color={s.color} size={28}/>
              <span style={{ fontWeight: 600 }}>{s.name}</span>
              <span>{s.owner}</span>
              <span style={{ color: theme.accent, fontFamily: window.MALIKA.mono, fontSize: 12 }}>{s.tg}</span>
              <span style={{ fontFamily: window.MALIKA.mono, fontSize: 12, color: theme.textDim }}>{s.phone}</span>
              <StatusBadge theme={theme} kind={s.plan==='Pro'?'blue':s.plan==='Trial'?'yellow':'gray'} size="sm">{s.plan}</StatusBadge>
              {s.status==='active'
                ? <StatusBadge theme={theme} kind="green" dot size="sm">{lang==='uz'?'Faol':'Активен'}</StatusBadge>
                : <StatusBadge theme={theme} kind="gray" dot size="sm">{lang==='uz'?'Muzlatilgan':'Заморожен'}</StatusBadge>}
              <span style={{ color: theme.textDim, fontFamily: window.MALIKA.mono, fontSize: 12 }}>{s.joined}</span>
              <button style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: theme.textDim, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconMore size={16}/>
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 4px', fontSize: 12, color: theme.textDim }}>
          <span>{lang==='uz'?'Ko\'rsatildi':'Показано'} 9 {lang==='uz'?'dan':'из'} 47</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.bg2, color: theme.text, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>← {lang==='uz'?'Oldingi':'Назад'}</button>
            <button style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.bg2, color: theme.text, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>{lang==='uz'?'Keyingi':'Дальше'} →</button>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

// ─────────────────────────────────────────────────────────────
// D2. СОЗДАТЬ МАГАЗИН — desktop form
// ─────────────────────────────────────────────────────────────
function ScreenDesktopCreate({ theme, lang }) {
  const t = lang === 'uz' ? {
    title: "Yangi do'kon", sub: "Yangi nuqta yaratish",
    section1: "Do'kon", section2: 'Egasi', section3: "Veb-kirish",
    shopName: "Do'kon nomi", langLabel: 'Standart til',
    tgId: 'Telegram ID', tgUsername: 'Username', name: "To'liq ism", phone: 'Telefon',
    login: 'Login', password: 'Parol', optional: 'Ixtiyoriy',
    cancel: 'Bekor qilish', register: "Ro'yxatdan o'tkazish",
    notice: 'Egasiga Telegram orqali botdan xabar yuboriladi',
  } : {
    title: 'Создать магазин', sub: 'Регистрация новой точки',
    section1: 'Магазин', section2: 'Владелец', section3: 'Веб-доступ',
    shopName: 'Название точки', langLabel: 'Язык по умолчанию',
    tgId: 'Telegram ID', tgUsername: 'Username', name: 'Полное имя', phone: 'Телефон',
    login: 'Логин', password: 'Пароль', optional: 'Опционально',
    cancel: 'Отмена', register: 'Зарегистрировать',
    notice: 'Владельцу придёт уведомление от Telegram-бота',
  };

  const fieldStyle = {
    display: 'flex', flexDirection: 'column', gap: 6,
  };
  const inputStyle = {
    height: 40, padding: '0 12px', borderRadius: 8,
    border: `1px solid ${theme.border}`, background: theme.bg3, color: theme.text,
    fontSize: 14, fontFamily: 'inherit', display: 'flex', alignItems: 'center',
  };
  const labelStyle = {
    fontSize: 12, color: theme.textDim, fontWeight: 500,
  };

  return (
    <DesktopShell theme={theme} lang={lang} active="create" title={t.title} sub={t.sub}>
      <div style={{ padding: '24px 24px 80px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Section 1 — Shop */}
          <div style={{ background: theme.bg3, borderRadius: 12, border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconStore size={18} stroke={theme.textDim}/>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{t.section1}</span>
            </div>
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>{t.shopName}</label>
                <div style={inputStyle}>Malika Точка 48</div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>{t.langLabel}</label>
                <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${theme.border}`, height: 40 }}>
                  <button style={{ flex: 1, border: 'none', background: theme.accent, color: theme.onAccent, fontFamily: 'inherit', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Русский</button>
                  <button style={{ flex: 1, border: 'none', background: theme.bg2, color: theme.text, fontFamily: 'inherit', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>O'zbekcha</button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2 — Owner */}
          <div style={{ background: theme.bg3, borderRadius: 12, border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconUsers size={18} stroke={theme.textDim}/>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{t.section2}</span>
            </div>
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>{t.tgId}</label>
                <div style={{ ...inputStyle, fontFamily: window.MALIKA.mono }}>546721834</div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>{t.tgUsername}</label>
                <div style={{ ...inputStyle, color: theme.accent }}>@sardor_a</div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>{t.name}</label>
                <div style={inputStyle}>Сардор Абдуллаев</div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>{t.phone}</label>
                <div style={{ ...inputStyle, fontFamily: window.MALIKA.mono }}>+998 90 999 11 22</div>
              </div>
            </div>
          </div>

          {/* Section 3 — Web access (optional) */}
          <div style={{ background: theme.bg3, borderRadius: 12, border: `1px dashed ${theme.borderStrong}`, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px dashed ${theme.borderStrong}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconKey size={18} stroke={theme.textDim}/>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{t.section3}</span>
              <span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 600, padding: '2px 7px', background: theme.bg2, borderRadius: 4, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>{t.optional}</span>
            </div>
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>{t.login}</label>
                <div style={{ ...inputStyle, fontFamily: window.MALIKA.mono }}>sardor.a</div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>{t.password}</label>
                <div style={{ ...inputStyle, fontFamily: window.MALIKA.mono }}>••••••••••</div>
              </div>
            </div>
          </div>

          {/* Notice + actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: theme.accentFaded, borderRadius: 10, fontSize: 13, color: theme.accent }}>
            <IconBell size={16}/> {t.notice}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <Button theme={theme} variant="secondary" size="md">{t.cancel}</Button>
            <Button theme={theme} size="md">{t.register}</Button>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

// ─────────────────────────────────────────────────────────────
// D3. ЖУРНАЛ ВХОДОВ — desktop
// ─────────────────────────────────────────────────────────────
function ScreenDesktopLogFull({ theme, lang }) {
  const t = lang === 'uz' ? {
    title: "Kirish jurnali", sub: "Bugun: 47 ta · 3 muvaffaqiyatsiz",
    date: 'Sana', src: 'Manba', who: 'Identifikator', shop: "Do'kon", status: 'Holati', ip: 'IP',
    today: 'Bugun', d7: '7 kun', failed: "Muvaffaqiyatsiz", stranger: "Noma'lum",
  } : {
    title: 'Журнал попыток входа', sub: 'Сегодня: 47 · 3 неудачных',
    date: 'Дата', src: 'Источник', who: 'Идентификатор', shop: 'Магазин', status: 'Статус', ip: 'IP',
    today: 'Сегодня', d7: '7 дней', failed: 'Неудачные', stranger: 'Незнакомый',
  };
  const rows = [
    { d: '27.04.2026 14:23:14', src: 'telegram', who: '@alisher_t', shop: 'Точка 14', ok: true, ip: '95.214.176.21' },
    { d: '27.04.2026 14:08:02', src: 'login', who: 'jasur.k', shop: 'Точка 7', ok: true, ip: '213.230.94.8' },
    { d: '27.04.2026 13:51:47', src: 'telegram', who: '@unknown_user_8821', shop: '—', ok: false, stranger: true, ip: '185.93.82.45' },
    { d: '27.04.2026 13:40:11', src: 'bot_start', who: 'tg_id 9821334', shop: '—', ok: false, stranger: true, ip: '178.218.207.9' },
    { d: '27.04.2026 12:14:38', src: 'telegram', who: '@bahrom_y', shop: 'Точка 22', ok: true, ip: '95.214.180.4' },
    { d: '27.04.2026 11:02:09', src: 'login', who: 'shokh_n', shop: 'Точка 3', ok: false, ip: '213.230.99.18' },
    { d: '27.04.2026 10:38:51', src: 'telegram', who: '@dilshod_a', shop: 'Точка 31', ok: true, ip: '95.214.176.21' },
    { d: '27.04.2026 09:55:24', src: 'admin', who: '@malika_admin', shop: '—', ok: true, ip: '92.51.108.4' },
    { d: '27.04.2026 09:14:03', src: 'telegram', who: '@alisher_t', shop: 'Точка 14', ok: true, ip: '95.214.176.21' },
    { d: '26.04.2026 22:11:18', src: 'login', who: 'rustam_kh', shop: 'Точка 8', ok: true, ip: '213.230.99.34' },
    { d: '26.04.2026 21:47:55', src: 'telegram', who: '@jasur_k', shop: 'Точка 7', ok: true, ip: '213.230.94.8' },
    { d: '26.04.2026 19:32:09', src: 'telegram', who: '@alisher_t', shop: 'Точка 14', ok: true, ip: '95.214.176.21' },
  ];
  return (
    <DesktopShell theme={theme} lang={lang} active="log" title={t.title} sub={t.sub}>
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { l: lang==='uz'?'Bugun':'Сегодня', v: '47', kind: null },
            { l: lang==='uz'?'Muvaffaqiyatli':'Успешных', v: '44', kind: 'green' },
            { l: lang==='uz'?'Muvaffaqiyatsiz':'Неудачных', v: '3', kind: 'red' },
            { l: lang==='uz'?"Noma'lum":'Незнакомых', v: '2', kind: 'red' },
          ].map((k, i) => (
            <div key={i} style={{ background: theme.bg3, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, color: theme.textDim, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{k.l}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: k.kind ? theme.status[k.kind].text : theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 4, letterSpacing: -0.4 }}>{k.v}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip theme={theme} active>{t.today}</Chip>
          <Chip theme={theme}>{t.d7}</Chip>
          <Chip theme={theme} danger active>{t.failed} · 3</Chip>
          <Chip theme={theme}>telegram</Chip>
          <Chip theme={theme}>login</Chip>
          <Chip theme={theme}>bot_start</Chip>
        </div>

        {/* Table */}
        <div style={{ background: theme.bg3, borderRadius: 12, border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '40px 1.4fr 0.9fr 1.6fr 1fr 1.2fr 60px',
            gap: 12, padding: '12px 18px', background: theme.bg2,
            borderBottom: `1px solid ${theme.border}`,
            fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: theme.textDim,
          }}>
            <span>{t.status}</span><span>{t.date}</span><span>{t.src}</span><span>{t.who}</span><span>{t.shop}</span><span>{t.ip}</span><span></span>
          </div>
          {rows.map((r, i) => {
            const c = r.ok ? theme.status.green : theme.status.red;
            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '40px 1.4fr 0.9fr 1.6fr 1fr 1.2fr 60px',
                gap: 12, padding: '12px 18px',
                borderBottom: i<rows.length-1?`1px solid ${theme.border}`:'none',
                alignItems: 'center', fontSize: 13,
                background: r.stranger ? theme.status.red.bg : 'transparent',
              }}>
                <div style={{ width: 26, height: 26, borderRadius: 13, background: c.bg, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${c.border}` }}>
                  {r.ok ? <IconCheck size={14}/> : <IconX size={14}/>}
                </div>
                <span style={{ fontFamily: window.MALIKA.mono, color: theme.textDim, fontSize: 12 }}>{r.d}</span>
                <span style={{ fontSize: 11, color: theme.textMuted, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.4 }}>{r.src}</span>
                <span style={{ fontFamily: window.MALIKA.mono, fontSize: 12, color: r.stranger ? c.text : theme.text, fontWeight: r.stranger ? 700 : 500 }}>
                  {r.who}{r.stranger && <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px', background: theme.status.red.bg, color: theme.status.red.text, borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>{t.stranger}</span>}
                </span>
                <span style={{ color: theme.textDim }}>{r.shop}</span>
                <span style={{ fontFamily: window.MALIKA.mono, fontSize: 12, color: theme.textMuted }}>{r.ip}</span>
                <button style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', color: theme.textDim, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconMore size={15}/></button>
              </div>
            );
          })}
        </div>
      </div>
    </DesktopShell>
  );
}

// ─────────────────────────────────────────────────────────────
// D4. ГЛОБАЛЬНЫЕ ДОЛГИ NASIYA — desktop table
// ─────────────────────────────────────────────────────────────
function ScreenDesktopDebts({ theme, lang }) {
  const t = lang === 'uz' ? {
    title: 'Global Nasiya qarzlari', sub: 'Platforma bo\'yicha barcha kechikishlar',
    shop: "Do'kon", buyer: 'Xaridor', phone: 'Telefon', dev: 'Qurilma',
    days: 'Kechikish', amt: "Qarz miqdori", actions: '',
    total: 'Umumiy qarz', overdue: "kechikkan", call: "Qo'ng'iroq",
  } : {
    title: 'Глобальные долги Nasiya', sub: 'Все просрочки по платформе',
    shop: 'Магазин', buyer: 'Покупатель', phone: 'Телефон', dev: 'Устройство',
    days: 'Просрочка', amt: 'Сумма долга', actions: '',
    total: 'Общий долг', overdue: 'просрочено', call: 'Звонок',
  };
  const debts = [
    { shop: 'Точка 8', buyer: 'Рустам Холматов', phone: '+998 99 789 01 23', dev: 'Galaxy S24 Ultra', days: 23, amt: 4200000 },
    { shop: 'Точка 14', buyer: 'Шохрух Назаров', phone: '+998 91 222 33 44', dev: 'Redmi Note 12 Pro', days: 18, amt: 1500000 },
    { shop: 'Точка 31', buyer: 'Бекзод Каримов', phone: '+998 93 555 66 77', dev: 'iPhone 13', days: 12, amt: 3200000 },
    { shop: 'Точка 7', buyer: 'Мирзо Юсупов', phone: '+998 90 111 22 33', dev: 'Galaxy A55', days: 9, amt: 1800000 },
    { shop: 'Точка 22', buyer: 'Дониёр Алиев', phone: '+998 97 888 99 00', dev: 'iPad Air 11"', days: 5, amt: 2500000 },
    { shop: 'Точка 14', buyer: 'Бахром Юсупов', phone: '+998 93 456 78 90', dev: 'Galaxy A55', days: 5, amt: 1500000 },
    { shop: 'Точка 19', buyer: 'Жасур Эргашев', phone: '+998 90 333 44 55', dev: 'MacBook Air M2', days: 3, amt: 7800000 },
    { shop: 'Точка 11', buyer: 'Шерзод Каримов', phone: '+998 91 666 77 88', dev: 'Galaxy A35', days: 1, amt: 950000 },
  ];
  const total = debts.reduce((s, d) => s+d.amt, 0);
  return (
    <DesktopShell theme={theme} lang={lang} active="debts" title={t.title} sub={t.sub}>
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Banner */}
        <div style={{
          background: theme.status.red.bg, border: `1px solid ${theme.status.red.border}`,
          borderRadius: 12, padding: '18px 22px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, color: theme.status.red.text, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{t.total}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: theme.status.red.text, fontVariantNumeric: 'tabular-nums', marginTop: 4, letterSpacing: -0.6 }}>{fmtUZS(total)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: theme.status.red.text, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{lang==='uz'?'Holat':'Просрочек'}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: theme.status.red.text, marginTop: 4, letterSpacing: -0.6 }}>{debts.length}</div>
          </div>
        </div>

        {/* Table */}
        <div style={{ background: theme.bg3, borderRadius: 12, border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1.6fr 1.2fr 1.4fr 1fr 1.1fr 80px',
            gap: 12, padding: '12px 18px', background: theme.bg2,
            borderBottom: `1px solid ${theme.border}`,
            fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: theme.textDim,
          }}>
            <span>{t.shop}</span><span>{t.buyer}</span><span>{t.phone}</span><span>{t.dev}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{t.days} <IconChevR size={11} style={{ transform: 'rotate(90deg)' }}/></span>
            <span style={{ textAlign: 'right' }}>{t.amt}</span><span></span>
          </div>
          {debts.map((d, i) => {
            const sev = d.days >= 14 ? 'red' : d.days >= 7 ? 'yellow' : 'gray';
            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr 1.6fr 1.2fr 1.4fr 1fr 1.1fr 80px',
                gap: 12, padding: '14px 18px',
                borderBottom: i<debts.length-1?`1px solid ${theme.border}`:'none',
                alignItems: 'center', fontSize: 13,
              }}>
                <span style={{ color: theme.textDim }}>{d.shop}</span>
                <span style={{ fontWeight: 600 }}>{d.buyer}</span>
                <span style={{ fontFamily: window.MALIKA.mono, fontSize: 12, color: theme.textDim }}>{d.phone}</span>
                <span style={{ color: theme.text }}>{d.dev}</span>
                <StatusBadge theme={theme} kind={sev} dot size="sm">{d.days} {lang==='uz'?'kun':'дн.'}</StatusBadge>
                <span style={{ textAlign: 'right', fontWeight: 700, color: theme.status.red.text, fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' }}>{fmtUZS(d.amt)}</span>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                  <button style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: theme.status.green.bg, color: theme.status.green.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={t.call}>
                    <IconPhoneCall size={15}/>
                  </button>
                  <button style={{ width: 30, height: 30, borderRadius: 7, border: 'none', background: 'transparent', color: theme.textDim, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconMore size={15}/>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DesktopShell>
  );
}

// ─────────────────────────────────────────────────────────────
// D5. СТАТИСТИКА ПЛАТФОРМЫ — dashboard
// ─────────────────────────────────────────────────────────────
function ScreenDesktopStats({ theme, lang }) {
  const t = lang === 'uz' ? {
    title: 'Platforma statistikasi', sub: 'Aprel · 2026',
    shopsTitle: "Do'konlar", shops: "Jami do'konlar", active: 'Faol', frozen: 'Muzlatilgan',
    trial: 'Trial', paid: "To'lovli",
    nasiyaTitle: "Nasiya", nasiyaActive: 'Faol Nasiya', overduePay: "Kechikkan to'lovlar", totalDebt: "Umumiy Nasiya qarzi",
    secTitle: 'Xavfsizlik', failed: "Bugun muvaffaqiyatsiz", revenue: 'Daromad',
    chart: '7 kun bo\'yicha sotuvlar', recent: "So'nggi do'konlar",
  } : {
    title: 'Статистика платформы', sub: 'Апрель · 2026',
    shopsTitle: 'Магазины', shops: 'Всего магазинов', active: 'Активных', frozen: 'Замороженных',
    trial: 'Trial', paid: 'Платных',
    nasiyaTitle: 'Nasiya', nasiyaActive: 'Активных', overduePay: 'Просроченных платежей', totalDebt: 'Общий долг по Nasiya',
    secTitle: 'Безопасность', failed: 'Неудачных входов сегодня', revenue: 'Доход платформы',
    chart: 'Активность за 7 дней', recent: 'Новые магазины',
  };

  const Stat = ({ label, value, kind, sub }) => {
    const c = kind ? theme.status[kind] : null;
    return (
      <div style={{ background: theme.bg3, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 18 }}>
        <div style={{ fontSize: 11, color: theme.textDim, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: c ? c.text : theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 6, letterSpacing: -0.5 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>{sub}</div>}
      </div>
    );
  };

  // Mini bar chart data — sales per day, last 7 days
  const days = lang==='uz'
    ? ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya']
    : ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const bars = [42, 38, 51, 47, 63, 71, 58]; // sales count
  const maxBar = Math.max(...bars);

  const recentShops = [
    { name: 'Точка 27', owner: 'Бекзод Юсупов', date: '20.04', plan: 'Trial' },
    { name: 'Точка 22', owner: 'Бахром Юсупов', date: '12.04', plan: 'Trial' },
    { name: 'Точка 19', owner: 'Сардор Алиев', date: '14.02', plan: 'Pro' },
    { name: 'Точка 31', owner: 'Дилшод Ахмедов', date: '10.09', plan: 'Pro' },
  ];

  return (
    <DesktopShell theme={theme} lang={lang} active="stats" title={t.title} sub={t.sub}>
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Hero — shops breakdown */}
        <div style={{ background: theme.bg3, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 12, color: theme.textDim, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{t.shops}</div>
              <div style={{ fontSize: 44, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 2, letterSpacing: -1 }}>47</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <StatusBadge theme={theme} kind="green" dot>{t.active} · 42</StatusBadge>
              <StatusBadge theme={theme} kind="gray" dot>{t.frozen} · 5</StatusBadge>
              <StatusBadge theme={theme} kind="yellow">{t.trial} · 12</StatusBadge>
              <StatusBadge theme={theme} kind="blue">{t.paid} · 30</StatusBadge>
            </div>
          </div>
          <div style={{ height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex', background: theme.bg2 }}>
            <div style={{ flex: 30, background: theme.status.blue.solid }}/>
            <div style={{ flex: 12, background: theme.status.yellow.solid }}/>
            <div style={{ flex: 5, background: theme.status.gray.solid }}/>
          </div>
        </div>

        {/* Two columns: KPIs + chart */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 16 }}>
          {/* KPI grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignContent: 'start' }}>
            <Stat label={t.nasiyaActive} value="156" kind="blue"/>
            <Stat label={t.overduePay} value="23" kind="red"/>
            <Stat label={t.failed} value="3" kind="red"/>
            <Stat label={t.revenue} value={fmtUZS(8400000)} kind="green" sub={t.sub}/>
            <div style={{ gridColumn: '1 / -1' }}>
              <Stat label={t.totalDebt} value={fmtUZS(45000000)} kind="red"/>
            </div>
          </div>

          {/* Sparkline / bar chart */}
          <div style={{ background: theme.bg3, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 12, color: theme.textDim, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{t.chart}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4, letterSpacing: -0.4, fontVariantNumeric: 'tabular-nums' }}>{bars.reduce((s,n)=>s+n,0)} <span style={{ fontSize: 13, color: theme.textDim, fontWeight: 500 }}>{lang==='uz'?'sotuv':'продаж'}</span></div>
            <div style={{ flex: 1, marginTop: 18, display: 'flex', alignItems: 'flex-end', gap: 12, paddingBottom: 22, position: 'relative' }}>
              {bars.map((v, i) => {
                const isMax = v === maxBar;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{
                      width: '100%', height: `${(v/maxBar)*100}%`,
                      background: isMax ? theme.accent : theme.bg2,
                      border: `1px solid ${isMax ? theme.accent : theme.border}`,
                      borderRadius: 4, position: 'relative',
                    }}>
                      {isMax && <div style={{ position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)', fontSize: 11, fontWeight: 700, color: theme.accent, fontVariantNumeric: 'tabular-nums' }}>{v}</div>}
                    </div>
                    <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500 }}>{days[i]}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent shops */}
        <div style={{ background: theme.bg3, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{t.recent}</span>
            <span style={{ fontSize: 12, color: theme.accent, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>{lang==='uz'?'Hammasi':'Все'} <IconChevR size={14}/></span>
          </div>
          {recentShops.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderBottom: i<recentShops.length-1?`1px solid ${theme.border}`:'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: theme.bg2, color: theme.textDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconStore size={16}/></div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</span>
                <span style={{ fontSize: 12, color: theme.textDim }}>{s.owner}</span>
              </div>
              <span style={{ fontSize: 12, color: theme.textDim, fontFamily: window.MALIKA.mono }}>{s.date}.2026</span>
              <StatusBadge theme={theme} kind={s.plan==='Pro'?'blue':'yellow'} size="sm">{s.plan}</StatusBadge>
            </div>
          ))}
        </div>
      </div>
    </DesktopShell>
  );
}

// ─────────────────────────────────────────────────────────────
// D6. КАРТОЧКА МАГАЗИНА — desktop master/detail
// ─────────────────────────────────────────────────────────────
function ScreenDesktopShop({ theme, lang }) {
  const t = lang === 'uz' ? {
    title: "Malika Точка 14", sub: 'Egasi: Алишер Турсунов',
    freeze: 'Muzlatish', changePlan: 'Reja', resetPwd: 'Login/parolni tiklash',
    contact: 'Aloqa', login: 'Login',
    stats: 'Statistika', devices: "Qurilmalar", sales: 'Sotuvlar', profit: 'Foyda', debts: "Qarz",
    history: "Kirish tarixi (10)",
  } : {
    title: 'Malika Точка 14', sub: 'Владелец: Алишер Турсунов',
    freeze: 'Заморозить', changePlan: 'Сменить план', resetPwd: 'Сбросить логин/пароль',
    contact: 'Контакты', login: 'Логин',
    stats: 'Статистика', devices: 'Устройств', sales: 'Продаж', profit: 'Прибыль', debts: 'Долги',
    history: 'История входов · 10',
  };
  const logins = [
    { date: '27.04.2026 14:23', src: 'telegram', ok: true, who: '@alisher_t', ip: '95.214.176.21' },
    { date: '27.04.2026 09:14', src: 'telegram', ok: true, who: '@alisher_t', ip: '95.214.176.21' },
    { date: '26.04.2026 19:32', src: 'telegram', ok: true, who: '@alisher_t', ip: '95.214.176.21' },
    { date: '26.04.2026 08:55', src: 'login', ok: true, who: 'alisher.t', ip: '92.51.108.4' },
    { date: '25.04.2026 22:11', src: 'login', ok: false, who: 'alisher.t', ip: '92.51.108.4' },
    { date: '25.04.2026 09:02', src: 'telegram', ok: true, who: '@alisher_t', ip: '95.214.176.21' },
    { date: '24.04.2026 18:44', src: 'telegram', ok: true, who: '@alisher_t', ip: '95.214.176.21' },
    { date: '24.04.2026 09:11', src: 'telegram', ok: true, who: '@alisher_t', ip: '95.214.176.21' },
  ];
  const action = (
    <div style={{ display: 'flex', gap: 8 }}>
      <Button theme={theme} variant="secondary" size="md">{t.freeze}</Button>
      <Button theme={theme} size="md">{t.changePlan}</Button>
    </div>
  );
  return (
    <DesktopShell theme={theme} lang={lang} active="shops" title={t.title} sub={t.sub} action={action}>
      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16 }}>
        {/* LEFT — owner card + stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Owner */}
          <div style={{ background: theme.bg3, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${theme.border}`, fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: theme.textDim }}>{t.contact}</div>
            <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
              <Avatar initials="АТ" color="#10B981" size={56}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.2 }}>Алишер Турсунов</div>
                <div style={{ fontSize: 13, color: theme.accent, fontFamily: window.MALIKA.mono, marginTop: 2 }}>@alisher_t</div>
                <div style={{ fontSize: 12, color: theme.textDim, fontFamily: window.MALIKA.mono, marginTop: 2 }}>+998 90 123 45 67</div>
                <div style={{ fontSize: 12, color: theme.textMuted, fontFamily: window.MALIKA.mono, marginTop: 2 }}>{t.login}: alisher.t</div>
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${theme.border}`, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, color: theme.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <IconKey size={18}/> {t.resetPwd}
            </div>
          </div>

          {/* Stats grid */}
          <div style={{ background: theme.bg3, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${theme.border}`, fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: theme.textDim }}>{t.stats}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: theme.border }}>
              {[
                { l: t.devices, v: '12', kind: 'blue', I: IconBox },
                { l: t.sales, v: '27', kind: 'green', I: IconCash },
                { l: t.profit, v: fmtUZS(38400000), kind: 'green', I: IconChart, small: true },
                { l: t.debts, v: fmtUZS(3400000), kind: 'red', I: IconClipboard, small: true },
              ].map((s, i) => {
                const c = theme.status[s.kind];
                const Ic = s.I;
                return (
                  <div key={i} style={{ background: theme.bg3, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Ic size={16} stroke={c.text}/>
                      <div style={{ fontSize: 11, color: theme.textDim, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s.l}</div>
                    </div>
                    <div style={{ fontSize: s.small ? 16 : 24, fontWeight: 700, color: c.text, fontVariantNumeric: 'tabular-nums', marginTop: 6, letterSpacing: -0.4 }}>{s.v}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT — login history */}
        <div style={{ background: theme.bg3, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden', alignSelf: 'start' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${theme.border}`, fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: theme.textDim, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconClock size={14}/> {t.history}
          </div>
          {logins.map((l, i) => {
            const c = l.ok ? theme.status.green : theme.status.red;
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1.4fr 0.7fr 1fr 1fr', gap: 12, padding: '12px 20px', borderBottom: i<logins.length-1?`1px solid ${theme.border}`:'none', alignItems: 'center', fontSize: 13 }}>
                <div style={{ width: 24, height: 24, borderRadius: 12, background: c.bg, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${c.border}` }}>
                  {l.ok ? <IconCheck size={13}/> : <IconX size={13}/>}
                </div>
                <span style={{ fontFamily: window.MALIKA.mono, color: theme.textDim, fontSize: 12 }}>{l.date}</span>
                <span style={{ fontSize: 10, color: theme.textMuted, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.4 }}>{l.src}</span>
                <span style={{ fontFamily: window.MALIKA.mono, fontSize: 12 }}>{l.who}</span>
                <span style={{ fontFamily: window.MALIKA.mono, fontSize: 11, color: theme.textMuted }}>{l.ip}</span>
              </div>
            );
          })}
        </div>
      </div>
    </DesktopShell>
  );
}

Object.assign(window, {
  ScreenDesktopShopsFull, ScreenDesktopCreate, ScreenDesktopLogFull,
  ScreenDesktopDebts, ScreenDesktopStats, ScreenDesktopShop,
});
