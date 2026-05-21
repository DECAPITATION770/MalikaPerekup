// screens-admin.jsx — Admin panel screens A1-A6
// A1 Магазины list, A2 Магазин card, A3 Создать магазин, A4 Журнал, A5 Долги, A6 Статистика

const { Screen, TopBar, BottomNav, Card, StatusBadge, Button, Chip,
  Field, Avatar, SectionTitle, fmtUZS, fmtSigned } = window;
const { IconSearch, IconArrowL, IconMore, IconX, IconPlus, IconStore, IconKey,
  IconShield, IconChevR, IconAlert, IconCheck, IconClock, IconUser, IconUsers,
  IconCrown, IconChart, IconPhoneCall, IconFilter, IconCalendar, IconBox } = window;

function iconBtn(theme, color) {
  return {
    width: 44, height: 44, borderRadius: 22, border: 'none',
    background: theme.bg2, color: color || theme.text,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    flexShrink: 0,
  };
}

// =========================================================
// A1. МАГАЗИНЫ — list
// =========================================================
function ScreenAdminShops({ theme, lang, isAdmin = true }) {
  const t = lang === 'uz' ? {
    title: "Do'konlar", sub: '47 ta · 42 faol',
    all: 'Barchasi', active: 'Faol', frozen: 'Muzlatilgan', trial: 'Trial',
    create: "Yangi do'kon",
    search: 'Nom yoki egasi...',
  } : {
    title: 'Магазины', sub: '47 точек · 42 активны',
    all: 'Все', active: 'Активные', frozen: 'Замороженные', trial: 'Trial',
    create: 'Создать магазин',
    search: 'Название или владелец...',
  };
  const shops = [
    { name: 'Malika Точка 14', owner: 'Алишер Турсунов', tg: '@alisher_t', phone: '+998 90 123 45 67', plan: 'Pro', status: 'active', joined: '15.04.2025' },
    { name: 'Malika Точка 7',  owner: 'Жасур Каримов', tg: '@jasur_k', phone: '+998 91 234 56 78', plan: 'Pro', status: 'active', joined: '02.06.2025' },
    { name: 'Malika Точка 22', owner: 'Бахром Юсупов', tg: '@bahrom_y', phone: '+998 93 456 78 90', plan: 'Trial', status: 'active', joined: '12.04.2026' },
    { name: 'Malika Точка 3',  owner: 'Шохрух Назаров', tg: '@shokh_n', phone: '+998 94 567 89 01', plan: 'Lite', status: 'frozen', joined: '20.01.2025' },
    { name: 'Malika Точка 31', owner: 'Дилшод Ахмедов', tg: '@dilshod_a', phone: '+998 97 678 90 12', plan: 'Pro', status: 'active', joined: '10.09.2025' },
    { name: 'Malika Точка 8',  owner: 'Рустам Холматов', tg: '@rustam_kh', phone: '+998 99 789 01 23', plan: 'Lite', status: 'active', joined: '03.11.2025' },
  ];

  return (
    <Screen theme={theme}>
      <TopBar theme={theme} title={t.title} sub={t.sub}
        right={<><button style={iconBtn(theme)}><IconSearch size={20}/></button><button style={iconBtn(theme, theme.accent)}><IconPlus size={22}/></button></>}
      />
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ padding: '12px 16px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: theme.bg2, borderRadius: 14, padding: '0 14px', height: 44, border: `1px solid ${theme.border}` }}>
            <IconSearch size={18} stroke={theme.textDim}/>
            <span style={{ flex: 1, color: theme.textMuted, fontSize: 15 }}>{t.search}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '4px 16px 12px', overflowX: 'auto' }}>
          <Chip theme={theme} active>{t.all} · 47</Chip>
          <Chip theme={theme}>{t.active} · 42</Chip>
          <Chip theme={theme}>{t.frozen} · 5</Chip>
          <Chip theme={theme}>{t.trial} · 12</Chip>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 16px 16px' }}>
          {shops.map((s, i) => (
            <Card key={i} theme={theme} padding={14}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: theme.bg2, color: theme.textDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconStore size={22}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>{s.name}</div>
                    {s.status === 'active'
                      ? <StatusBadge theme={theme} kind="green" dot size="sm">{t.active}</StatusBadge>
                      : <StatusBadge theme={theme} kind="gray" dot size="sm">{t.frozen}</StatusBadge>}
                  </div>
                  <div style={{ fontSize: 13, color: theme.text, marginTop: 4 }}>{s.owner}</div>
                  <div style={{ fontSize: 12, color: theme.textDim, marginTop: 1, display: 'flex', gap: 8 }}>
                    <span style={{ color: theme.accent }}>{s.tg}</span>
                    <span style={{ fontFamily: window.MALIKA.mono }}>{s.phone}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: theme.textMuted }}>{lang==='uz'?'Ro\'yxatdan:':'Регистрация:'} {s.joined}</span>
                    <StatusBadge theme={theme} kind={s.plan==='Pro'?'blue':s.plan==='Trial'?'yellow':'gray'} size="sm">{s.plan}</StatusBadge>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
      <BottomNav theme={theme} active="admin" isAdmin={isAdmin} lang={lang}/>
    </Screen>
  );
}

// =========================================================
// A2. КАРТОЧКА МАГАЗИНА
// =========================================================
function ScreenAdminShop({ theme, lang, isAdmin = true }) {
  const t = lang === 'uz' ? {
    title: "Do'kon", freeze: 'Muzlatish', changePlan: 'Reja',
    contact: 'Egasi', resetPwd: 'Login/parolni tiklash',
    stats: 'Statistika', devices: 'Qurilmalar', sales: 'Sotuvlar', profit: 'Foyda', debts: "Nasiya qarzi",
    history: "Kirish tarixi", success: 'Muvaffaqiyatli', failed: "Muvaffaqiyatsiz",
    login: 'Login', telegram: 'Telegram', bot: 'Bot',
  } : {
    title: 'Магазин', freeze: 'Заморозить', changePlan: 'План',
    contact: 'Владелец', resetPwd: 'Сбросить логин/пароль',
    stats: 'Статистика', devices: 'Устройств', sales: 'Продаж', profit: 'Прибыль', debts: 'Долги Nasiya',
    history: 'История входов', success: 'Успешно', failed: 'Неудачно',
    login: 'Логин', telegram: 'Telegram', bot: 'Бот',
  };
  const logins = [
    { date: '27.04 09:14', src: 'telegram', ok: true, who: '@alisher_t' },
    { date: '26.04 19:32', src: 'telegram', ok: true, who: '@alisher_t' },
    { date: '26.04 08:55', src: 'login', ok: true, who: 'alisher.t' },
    { date: '25.04 22:11', src: 'login', ok: false, who: 'alisher.t' },
    { date: '25.04 09:02', src: 'telegram', ok: true, who: '@alisher_t' },
  ];
  return (
    <Screen theme={theme}>
      <TopBar theme={theme} title={t.title} onBack right={<button style={iconBtn(theme)}><IconMore size={20}/></button>}/>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ padding: '14px 16px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: theme.bg2, color: theme.textDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconStore size={28}/></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.3 }}>Malika Точка 14</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <StatusBadge theme={theme} kind="green" dot>{lang==='uz'?'Faol':'Активен'}</StatusBadge>
                <StatusBadge theme={theme} kind="blue">Pro</StatusBadge>
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: '12px 16px 16px', display: 'flex', gap: 8 }}>
          <Button theme={theme} variant="secondary" size="md" full>{t.freeze}</Button>
          <Button theme={theme} variant="secondary" size="md" full>{t.changePlan}</Button>
        </div>

        <SectionTitle theme={theme}>{t.contact}</SectionTitle>
        <div style={{ padding: '0 16px 14px' }}>
          <Card theme={theme} padding={0}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
              <Avatar initials="АТ" color="#10B981" size={42}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Алишер Турсунов</div>
                <div style={{ fontSize: 12, color: theme.textDim, marginTop: 2 }}>
                  <span style={{ color: theme.accent }}>@alisher_t</span>  ·  <span style={{ fontFamily: window.MALIKA.mono }}>+998 90 123 45 67</span>
                </div>
                <div style={{ fontSize: 12, color: theme.textMuted, fontFamily: window.MALIKA.mono, marginTop: 1 }}>{t.login}: alisher.t</div>
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${theme.border}`, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, color: theme.accent, fontSize: 14, fontWeight: 600 }}>
              <IconKey size={18}/> {t.resetPwd}
            </div>
          </Card>
        </div>

        <SectionTitle theme={theme}>{t.stats}</SectionTitle>
        <div style={{ padding: '0 16px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { l: t.devices, v: '12', kind: 'blue' },
            { l: t.sales, v: '27', kind: 'green' },
            { l: t.profit, v: fmtUZS(38400000), kind: 'green', small: true },
            { l: t.debts, v: fmtUZS(3400000), kind: 'red', small: true },
          ].map((s, i) => (
            <Card key={i} theme={theme} padding={12}>
              <div style={{ fontSize: 11, color: theme.textDim, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s.l}</div>
              <div style={{ fontSize: s.small ? 16 : 22, fontWeight: 700, color: theme.status[s.kind].text, fontVariantNumeric: 'tabular-nums', marginTop: 4, letterSpacing: -0.3 }}>{s.v}</div>
            </Card>
          ))}
        </div>

        <SectionTitle theme={theme}>{t.history} · 10</SectionTitle>
        <div style={{ padding: '0 16px 16px' }}>
          <Card theme={theme} padding={0}>
            {logins.map((l, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i<logins.length-1?`1px solid ${theme.border}`:'none' }}>
                <div style={{ width: 26, height: 26, borderRadius: 13, background: l.ok?theme.status.green.bg:theme.status.red.bg, color: l.ok?theme.status.green.text:theme.status.red.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {l.ok ? <IconCheck size={14}/> : <IconX size={14}/>}
                </div>
                <div style={{ flex: 1, fontSize: 12, color: theme.textDim, fontFamily: window.MALIKA.mono }}>{l.date}</div>
                <span style={{ fontSize: 11, color: theme.textMuted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.4 }}>{l.src}</span>
                <span style={{ fontSize: 13, color: theme.text, fontFamily: window.MALIKA.mono }}>{l.who}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </Screen>
  );
}

// =========================================================
// A3. СОЗДАТЬ МАГАЗИН (form)
// =========================================================
function ScreenAdminCreate({ theme, lang }) {
  const t = lang === 'uz' ? {
    title: "Yangi do'kon",
    shopName: "Do'kon nomi", lang: "Standart til", tgId: 'Telegram ID',
    tgUsername: '@username', name: "To'liq ism", phone: 'Telefon',
    optional: 'Ixtiyoriy', login: 'Login', password: 'Parol',
    register: "Ro'yxatdan o'tkazish",
    sub: "Egasiga Telegram orqali habar yuboriladi",
  } : {
    title: 'Создать магазин',
    shopName: 'Название точки', lang: 'Язык по умолчанию', tgId: 'Telegram ID',
    tgUsername: '@username', name: 'Полное имя', phone: 'Телефон',
    optional: 'Опционально', login: 'Логин', password: 'Пароль',
    register: 'Зарегистрировать',
    sub: 'Владельцу придёт уведомление в Telegram',
  };
  return (
    <Screen theme={theme}>
      <TopBar theme={theme} title={t.title} onBack right={<button style={iconBtn(theme)}><IconX size={20}/></button>}/>
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field theme={theme} label={t.shopName} value="Malika Точка 48"/>
        <div>
          <div style={{ fontSize: 13, color: theme.textDim, fontWeight: 500, marginBottom: 8 }}>{t.lang}</div>
          <div style={{ display: 'flex', borderRadius: 12, overflow: 'hidden', border: `1px solid ${theme.border}`, background: theme.bg2 }}>
            <button style={{ flex: 1, height: 48, border: 'none', background: theme.accent, color: theme.onAccent, fontFamily: 'inherit', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Русский</button>
            <button style={{ flex: 1, height: 48, border: 'none', background: 'transparent', color: theme.text, fontFamily: 'inherit', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>O'zbekcha</button>
          </div>
        </div>
        <Field theme={theme} label={t.tgId} value="546721834" mono/>
        <Field theme={theme} label={t.tgUsername} value="@sardor_a"/>
        <Field theme={theme} label={t.name} value="Сардор Абдуллаев"/>
        <Field theme={theme} label={t.phone} value="+998 90 999 11 22" mono/>

        <div style={{
          padding: '12px 14px', borderRadius: 12,
          background: theme.bg2, border: `1px dashed ${theme.borderStrong}`,
        }}>
          <div style={{ fontSize: 12, color: theme.textDim, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10 }}>{t.optional}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field theme={theme} label={t.login} value="sardor.a" mono/>
            <Field theme={theme} label={t.password} value="••••••••••" mono/>
          </div>
        </div>

        <div style={{ fontSize: 12, color: theme.textMuted, padding: '0 4px' }}>{t.sub}</div>
      </div>
      <div style={{ padding: '12px 16px 12px', background: theme.bg, borderTop: `1px solid ${theme.border}` }}>
        <Button theme={theme} size="lg" full>{t.register}</Button>
      </div>
    </Screen>
  );
}

// =========================================================
// A4. ЖУРНАЛ ВХОДОВ
// =========================================================
function ScreenAdminLog({ theme, lang, isAdmin = true }) {
  const t = lang === 'uz' ? {
    title: "Kirish jurnali", sub: 'Bugun: 47 ta · 3 muvaffaqiyatsiz',
    all: 'Barchasi', failed: "Muvaffaqiyatsiz", today: 'Bugun', d7: '7 kun',
    stranger: "Noma'lum",
  } : {
    title: 'Журнал входов', sub: 'Сегодня: 47 · 3 неудачных',
    all: 'Все', failed: 'Неудачные', today: 'Сегодня', d7: '7 дней',
    stranger: 'Незнакомый',
  };
  const rows = [
    { d: '27.04 14:23', src: 'telegram', who: '@alisher_t', shop: 'Точка 14', ok: true },
    { d: '27.04 14:08', src: 'login',    who: 'jasur.k',   shop: 'Точка 7',  ok: true },
    { d: '27.04 13:51', src: 'telegram', who: '@unknown_user_8821', shop: '—', ok: false, stranger: true },
    { d: '27.04 13:40', src: 'bot_start',who: 'tg_id 9821334', shop: '—',     ok: false, stranger: true },
    { d: '27.04 12:14', src: 'telegram', who: '@bahrom_y',  shop: 'Точка 22', ok: true },
    { d: '27.04 11:02', src: 'login',    who: 'shokh_n',    shop: 'Точка 3',  ok: false },
    { d: '27.04 10:38', src: 'telegram', who: '@dilshod_a', shop: 'Точка 31', ok: true },
    { d: '27.04 09:55', src: 'admin',    who: '@malika_admin', shop: '—',     ok: true },
    { d: '27.04 09:14', src: 'telegram', who: '@alisher_t', shop: 'Точка 14', ok: true },
  ];
  return (
    <Screen theme={theme}>
      <TopBar theme={theme} title={t.title} sub={t.sub}
        right={<button style={iconBtn(theme)}><IconFilter size={20}/></button>}
      />
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px 12px', overflowX: 'auto' }}>
          <Chip theme={theme} active>{t.all}</Chip>
          <Chip theme={theme} danger active>{t.failed} · 3</Chip>
          <Chip theme={theme}>telegram</Chip>
          <Chip theme={theme}>login</Chip>
          <Chip theme={theme}>bot_start</Chip>
        </div>

        <div style={{ padding: '0 16px 16px' }}>
          <Card theme={theme} padding={0}>
            {rows.map((r, i) => {
              const c = r.ok ? theme.status.green : theme.status.red;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px',
                  borderBottom: i<rows.length-1?`1px solid ${theme.border}`:'none',
                  background: r.stranger ? theme.status.red.bg : 'transparent',
                }}>
                  <div style={{ width: 26, height: 26, borderRadius: 13, background: c.bg, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${c.border}` }}>
                    {r.ok ? <IconCheck size={14}/> : <IconX size={14}/>}
                  </div>
                  <div style={{ width: 84, fontSize: 11, color: theme.textDim, fontFamily: window.MALIKA.mono }}>{r.d}</div>
                  <div style={{ width: 70, fontSize: 10, color: theme.textMuted, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.4 }}>{r.src}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: r.stranger ? c.text : theme.text, fontFamily: window.MALIKA.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.who}</div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>{r.shop}{r.stranger && ` · ${t.stranger}`}</div>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      </div>
      <BottomNav theme={theme} active="admin" isAdmin={isAdmin} lang={lang}/>
    </Screen>
  );
}

// =========================================================
// A5. ГЛОБАЛЬНЫЕ ДОЛГИ NASIYA
// =========================================================
function ScreenAdminDebts({ theme, lang, isAdmin = true }) {
  const t = lang === 'uz' ? {
    title: "Global qarzlar", sub: 'Jami', overdue: 'kechikkan',
    days: 'kun', total: 'Jami qarz',
  } : {
    title: 'Глобальные долги', sub: 'Просрочено', overdue: 'просрочено',
    days: 'дн.', total: 'Общий долг',
  };
  const debts = [
    { shop: 'Точка 8', buyer: 'Рустам Холматов', phone: '+998 99 789 01 23', dev: 'Galaxy S24 Ultra', days: 23, amt: 4200000 },
    { shop: 'Точка 14', buyer: 'Шохрух Назаров', phone: '+998 91 222 33 44', dev: 'Redmi Note 12 Pro', days: 18, amt: 1500000 },
    { shop: 'Точка 31', buyer: 'Бекзод Каримов', phone: '+998 93 555 66 77', dev: 'iPhone 13', days: 12, amt: 3200000 },
    { shop: 'Точка 7', buyer: 'Мирзо Юсупов', phone: '+998 90 111 22 33', dev: 'Galaxy A55', days: 9, amt: 1800000 },
    { shop: 'Точка 22', buyer: 'Дониёр Алиев', phone: '+998 97 888 99 00', dev: 'iPad Air 11"', days: 5, amt: 2500000 },
    { shop: 'Точка 14', buyer: 'Бахром Юсупов', phone: '+998 93 456 78 90', dev: 'Galaxy A55', days: 5, amt: 1500000 },
  ];
  const total = debts.reduce((s, d) => s+d.amt, 0);
  return (
    <Screen theme={theme}>
      <TopBar theme={theme} title={t.title} sub={`${debts.length} ${t.overdue}`}/>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ padding: '14px 16px 12px' }}>
          <Card theme={theme} padding={14} style={{ background: theme.status.red.bg, border: `1px solid ${theme.status.red.border}` }}>
            <div style={{ fontSize: 12, color: theme.status.red.text, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{t.total}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: theme.status.red.text, fontVariantNumeric: 'tabular-nums', marginTop: 4, letterSpacing: -0.5 }}>{fmtUZS(total)}</div>
          </Card>
        </div>

        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {debts.map((d, i) => (
            <Card key={i} theme={theme} padding={12}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2 }}>{d.buyer}</div>
                    <StatusBadge theme={theme} kind="red" dot size="sm">{d.days} {t.days}</StatusBadge>
                  </div>
                  <div style={{ fontSize: 12, color: theme.textDim, marginTop: 2 }}>{d.shop} · {d.dev}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: theme.textMuted, fontFamily: window.MALIKA.mono }}>{d.phone}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: theme.status.red.text, fontVariantNumeric: 'tabular-nums' }}>{fmtUZS(d.amt)}</span>
                  </div>
                </div>
                <button style={{ width: 40, height: 40, borderRadius: 20, border: 'none', background: theme.status.green.bg, color: theme.status.green.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <IconPhoneCall size={18}/>
                </button>
              </div>
            </Card>
          ))}
        </div>
      </div>
      <BottomNav theme={theme} active="admin" isAdmin={isAdmin} lang={lang}/>
    </Screen>
  );
}

// =========================================================
// A6. СТАТИСТИКА ПЛАТФОРМЫ
// =========================================================
function ScreenAdminStats({ theme, lang, isAdmin = true }) {
  const t = lang === 'uz' ? {
    title: 'Platforma',
    shops: "Jami do'konlar", active: 'Faol', frozen: 'Muzlatilgan',
    trial: 'Trial', paid: "To'lovli",
    nasiyaActive: 'Faol Nasiya', overduePay: "Kechikkan to'lovlar", totalDebt: "Umumiy Nasiya qarzi",
    failed: "Bugun muvaffaqiyatsiz", revenue: 'Platforma daromadi',
  } : {
    title: 'Платформа',
    shops: 'Всего магазинов', active: 'Активных', frozen: 'Замороженных',
    trial: 'Trial', paid: 'Платных',
    nasiyaActive: 'Активных Nasiya', overduePay: 'Просроченных платежей', totalDebt: 'Общий долг по Nasiya',
    failed: 'Неудачных входов сегодня', revenue: 'Доход платформы',
  };
  const Stat = ({ label, value, kind, big, sub }) => {
    const c = kind ? theme.status[kind] : null;
    return (
      <Card theme={theme} padding={14}>
        <div style={{ fontSize: 11, color: theme.textDim, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: big ? 28 : 22, fontWeight: 700, color: c ? c.text : theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 4, letterSpacing: -0.4 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{sub}</div>}
      </Card>
    );
  };
  return (
    <Screen theme={theme}>
      <TopBar theme={theme} title={t.title}/>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <SectionTitle theme={theme}>{lang==='uz'?"Do'konlar":'Магазины'}</SectionTitle>
        <div style={{ padding: '0 16px 14px' }}>
          <Card theme={theme} padding={16}>
            <div style={{ fontSize: 11, color: theme.textDim, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>{t.shops}</div>
            <div style={{ fontSize: 36, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 4, letterSpacing: -0.8 }}>47</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              <StatusBadge theme={theme} kind="green" dot size="sm">{t.active} · 42</StatusBadge>
              <StatusBadge theme={theme} kind="gray" dot size="sm">{t.frozen} · 5</StatusBadge>
              <StatusBadge theme={theme} kind="yellow" size="sm">{t.trial} · 12</StatusBadge>
              <StatusBadge theme={theme} kind="blue" size="sm">{t.paid} · 30</StatusBadge>
            </div>
            {/* mini bar */}
            <div style={{ marginTop: 14, height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
              <div style={{ flex: 30, background: theme.status.blue.solid }}/>
              <div style={{ flex: 12, background: theme.status.yellow.solid }}/>
              <div style={{ flex: 5, background: theme.status.gray.solid }}/>
            </div>
          </Card>
        </div>

        <SectionTitle theme={theme}>Nasiya</SectionTitle>
        <div style={{ padding: '0 16px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Stat label={t.nasiyaActive} value="156" kind="blue"/>
          <Stat label={t.overduePay} value="23" kind="red"/>
        </div>
        <div style={{ padding: '0 16px 14px' }}>
          <Stat label={t.totalDebt} value={fmtUZS(45000000)} kind="red" big/>
        </div>

        <SectionTitle theme={theme}>{lang==='uz'?'Xavfsizlik':'Безопасность'}</SectionTitle>
        <div style={{ padding: '0 16px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Stat label={t.failed} value="3" kind="red"/>
          <Stat label={t.revenue} value={fmtUZS(8400000)} kind="green" sub={lang==='uz'?'Aprel':'Апрель'}/>
        </div>
        <div style={{ height: 12 }}/>
      </div>
      <BottomNav theme={theme} active="admin" isAdmin={isAdmin} lang={lang}/>
    </Screen>
  );
}

// =========================================================
// DESKTOP variant — Telegram Desktop, ~768px wide. Shop list
// rendered as a real table for admin work.
// =========================================================
function ScreenDesktopShops({ theme, lang }) {
  const t = lang === 'uz' ? {
    title: "Do'konlar", create: "Yangi", search: "Qidiruv...",
    name: "Nom", owner: 'Egasi', tg: 'Telegram', phone: 'Telefon',
    plan: 'Reja', status: 'Holati', joined: "Ro'yxat", actions: '',
  } : {
    title: 'Магазины', create: 'Создать', search: 'Поиск...',
    name: 'Название', owner: 'Владелец', tg: 'Telegram', phone: 'Телефон',
    plan: 'План', status: 'Статус', joined: 'Регистрация', actions: '',
  };
  const shops = [
    { name: 'Malika Точка 14', owner: 'Алишер Турсунов', tg: '@alisher_t', phone: '+998 90 123 45 67', plan: 'Pro', status: 'active', joined: '15.04.2025' },
    { name: 'Malika Точка 7', owner: 'Жасур Каримов', tg: '@jasur_k', phone: '+998 91 234 56 78', plan: 'Pro', status: 'active', joined: '02.06.2025' },
    { name: 'Malika Точка 22', owner: 'Бахром Юсупов', tg: '@bahrom_y', phone: '+998 93 456 78 90', plan: 'Trial', status: 'active', joined: '12.04.2026' },
    { name: 'Malika Точка 3', owner: 'Шохрух Назаров', tg: '@shokh_n', phone: '+998 94 567 89 01', plan: 'Lite', status: 'frozen', joined: '20.01.2025' },
    { name: 'Malika Точка 31', owner: 'Дилшод Ахмедов', tg: '@dilshod_a', phone: '+998 97 678 90 12', plan: 'Pro', status: 'active', joined: '10.09.2025' },
    { name: 'Malika Точка 8', owner: 'Рустам Холматов', tg: '@rustam_kh', phone: '+998 99 789 01 23', plan: 'Lite', status: 'active', joined: '03.11.2025' },
    { name: 'Malika Точка 19', owner: 'Сардор Алиев', tg: '@sardor_a', phone: '+998 90 111 22 33', plan: 'Pro', status: 'active', joined: '14.02.2026' },
  ];
  return (
    <div style={{ width: '100%', height: '100%', background: theme.bg, color: theme.text, fontFamily: window.MALIKA.font, display: 'flex', flexDirection: 'column' }}>
      {/* desktop "Telegram" header */}
      <div style={{ padding: '14px 24px', borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: theme.accent, color: theme.onAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>M</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.2 }}>Malika Admin</div>
          <div style={{ fontSize: 12, color: theme.textDim }}>{t.title} · 47</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: theme.bg2, borderRadius: 10, padding: '0 12px', height: 36, width: 280, border: `1px solid ${theme.border}` }}>
          <IconSearch size={16} stroke={theme.textDim}/>
          <span style={{ flex: 1, color: theme.textMuted, fontSize: 13 }}>{t.search}</span>
        </div>
        <Button theme={theme} size="md" icon={<IconPlus size={18}/>}>{t.create}</Button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <div style={{ background: theme.bg3, borderRadius: 12, border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.6fr 1.2fr 1.4fr 0.8fr 1fr 1fr 40px', gap: 12, padding: '12px 16px', background: theme.bg2, borderBottom: `1px solid ${theme.border}`, fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: theme.textDim }}>
            <span>{t.name}</span><span>{t.owner}</span><span>{t.tg}</span><span>{t.phone}</span><span>{t.plan}</span><span>{t.status}</span><span>{t.joined}</span><span></span>
          </div>
          {shops.map((s, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.6fr 1.2fr 1.4fr 0.8fr 1fr 1fr 40px', gap: 12, padding: '14px 16px', borderBottom: i<shops.length-1?`1px solid ${theme.border}`:'none', alignItems: 'center', fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>{s.name}</span>
              <span>{s.owner}</span>
              <span style={{ color: theme.accent, fontFamily: window.MALIKA.mono, fontSize: 12 }}>{s.tg}</span>
              <span style={{ fontFamily: window.MALIKA.mono, fontSize: 12, color: theme.textDim }}>{s.phone}</span>
              <StatusBadge theme={theme} kind={s.plan==='Pro'?'blue':s.plan==='Trial'?'yellow':'gray'} size="sm">{s.plan}</StatusBadge>
              {s.status==='active'
                ? <StatusBadge theme={theme} kind="green" dot size="sm">{lang==='uz'?'Faol':'Активен'}</StatusBadge>
                : <StatusBadge theme={theme} kind="gray" dot size="sm">{lang==='uz'?'Muzl.':'Заморожен'}</StatusBadge>}
              <span style={{ color: theme.textDim, fontFamily: window.MALIKA.mono, fontSize: 12 }}>{s.joined}</span>
              <button style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: theme.textDim, cursor: 'pointer' }}><IconMore size={16}/></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Desktop login log
function ScreenDesktopLog({ theme, lang }) {
  const t = lang === 'uz' ? {
    title: "Kirish jurnali", search: 'Qidiruv...', date: 'Sana', src: 'Manba', who: 'Kim', shop: "Do'kon", status: 'Holati', ip: 'IP',
  } : {
    title: 'Журнал входов', search: 'Поиск...', date: 'Дата', src: 'Источник', who: 'Идентификатор', shop: 'Магазин', status: 'Статус', ip: 'IP',
  };
  const rows = [
    { d: '27.04 14:23', src: 'telegram', who: '@alisher_t', shop: 'Точка 14', ok: true, ip: '95.214.176.21' },
    { d: '27.04 14:08', src: 'login', who: 'jasur.k', shop: 'Точка 7', ok: true, ip: '213.230.94.8' },
    { d: '27.04 13:51', src: 'telegram', who: '@unknown_user_8821', shop: '—', ok: false, stranger: true, ip: '185.93.82.45' },
    { d: '27.04 13:40', src: 'bot_start', who: 'tg_id 9821334', shop: '—', ok: false, stranger: true, ip: '178.218.207.9' },
    { d: '27.04 12:14', src: 'telegram', who: '@bahrom_y', shop: 'Точка 22', ok: true, ip: '95.214.180.4' },
    { d: '27.04 11:02', src: 'login', who: 'shokh_n', shop: 'Точка 3', ok: false, ip: '213.230.99.18' },
    { d: '27.04 10:38', src: 'telegram', who: '@dilshod_a', shop: 'Точка 31', ok: true, ip: '95.214.176.21' },
    { d: '27.04 09:55', src: 'admin', who: '@malika_admin', shop: '—', ok: true, ip: '92.51.108.4' },
    { d: '27.04 09:14', src: 'telegram', who: '@alisher_t', shop: 'Точка 14', ok: true, ip: '95.214.176.21' },
    { d: '26.04 22:11', src: 'login', who: 'rustam_kh', shop: 'Точка 8', ok: true, ip: '213.230.99.34' },
  ];
  return (
    <div style={{ width: '100%', height: '100%', background: theme.bg, color: theme.text, fontFamily: window.MALIKA.font, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 24px', borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: theme.accent, color: theme.onAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>M</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.2 }}>{t.title}</div>
          <div style={{ fontSize: 12, color: theme.textDim }}>{lang==='uz'?'Bugun':'Сегодня'}: 47 · 3 {lang==='uz'?"muvaffaqiyatsiz":'неудачных'}</div>
        </div>
        <Chip theme={theme} active>{lang==='uz'?'Bugun':'Сегодня'}</Chip>
        <Chip theme={theme}>{lang==='uz'?'Muvaff.siz':'Неудачные'}</Chip>
        <Chip theme={theme}>telegram</Chip>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <div style={{ background: theme.bg3, borderRadius: 12, border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1.2fr 0.8fr 1.6fr 1fr 1.2fr 1fr', gap: 12, padding: '12px 16px', background: theme.bg2, borderBottom: `1px solid ${theme.border}`, fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: theme.textDim }}>
            <span>{t.status}</span><span>{t.date}</span><span>{t.src}</span><span>{t.who}</span><span>{t.shop}</span><span>{t.ip}</span><span></span>
          </div>
          {rows.map((r, i) => {
            const c = r.ok ? theme.status.green : theme.status.red;
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1.2fr 0.8fr 1.6fr 1fr 1.2fr 1fr', gap: 12, padding: '12px 16px', borderBottom: i<rows.length-1?`1px solid ${theme.border}`:'none', alignItems: 'center', fontSize: 13, background: r.stranger ? theme.status.red.bg : 'transparent' }}>
                <div style={{ width: 24, height: 24, borderRadius: 12, background: c.bg, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${c.border}` }}>
                  {r.ok ? <IconCheck size={13}/> : <IconX size={13}/>}
                </div>
                <span style={{ fontFamily: window.MALIKA.mono, color: theme.textDim, fontSize: 12 }}>{r.d}</span>
                <span style={{ fontSize: 11, color: theme.textMuted, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.4 }}>{r.src}</span>
                <span style={{ fontFamily: window.MALIKA.mono, fontSize: 12, color: r.stranger ? c.text : theme.text, fontWeight: r.stranger ? 700 : 500 }}>{r.who}</span>
                <span style={{ color: theme.textDim }}>{r.shop}</span>
                <span style={{ fontFamily: window.MALIKA.mono, fontSize: 12, color: theme.textMuted }}>{r.ip}</span>
                <span></span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  ScreenAdminShops, ScreenAdminShop, ScreenAdminCreate, ScreenAdminLog,
  ScreenAdminDebts, ScreenAdminStats,
  ScreenDesktopShops, ScreenDesktopLog,
});
