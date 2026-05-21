// screens-app1.jsx — Mini App screens 1-6
// 1 Splash, 2 Today, 3 Витрина, 4 +Купил, 5 +Продал, 6 Карточка устройства

const { Screen, TopBar, BottomNav, Card, StatusBadge, Button, Chip, CategoryTile,
  Field, ProgressBar, Avatar, DeviceIcon, SectionTitle,
  fmtUZS, fmtUSD, fmtSigned } = window;
const { IconSearch, IconCamera, IconQr, IconPlus, IconPhoneCall, IconAlert,
  IconClock, IconCheck, IconChevR, IconChevL, IconArrowL, IconMore, IconX,
  IconBox, IconMoney, IconSnowflake, IconClipboard, IconCalendar,
  IconPhone, IconTablet, IconLaptop, IconWatch, IconHeadphones,
  IconUpload, IconImage, IconRefund, IconEdit, IconPrint, IconUser, IconStar, IconCash } = window;

// =========================================================
// 1. SPLASH
// =========================================================
function ScreenSplash({ theme, lang }) {
  const t = lang === 'uz' ? {
    open: 'Ilovani ochmoqdamiz...',
    sub: 'Malika · Toshkent',
  } : { open: 'Открываем приложение...', sub: 'Malika · Ташкент' };
  return (
    <Screen theme={theme}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, padding: 24 }}>
        <div style={{
          width: 96, height: 96, borderRadius: 28,
          background: theme.accent, color: theme.onAccent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 44, fontWeight: 800, letterSpacing: -1,
          boxShadow: `0 12px 40px ${theme.accent}40`,
        }}>M</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.6, color: theme.text }}>Malika</div>
          <div style={{ fontSize: 14, color: theme.textDim, marginTop: 4 }}>{t.sub}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {[0,1,2].map(i => (
            <span key={i} style={{ width: 8, height: 8, borderRadius: 8, background: theme.accent, opacity: 0.3 + (i*0.25) }}/>
          ))}
        </div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 4 }}>{t.open}</div>
      </div>
    </Screen>
  );
}

// =========================================================
// 2. TODAY (dashboard)
// =========================================================
function ScreenToday({ theme, lang, isAdmin }) {
  const t = lang === 'uz' ? {
    title: 'Bugun', greet: 'Salom, Alisher', date: '27 aprel, dushanba',
    profit: 'Foyda bugun', stock: 'Vitrinada', frozen: 'Muzlatilgan', debts: 'Nasiya qarzi',
    items: 'qurilma',
    payments: "Bugungi to'lovlar", buy: '+ Sotib oldim', sell: "+ Sotdim",
    overdue: 'kechikdi', today: 'bugun', tomorrow: 'ertaga',
  } : {
    title: 'Сегодня', greet: 'Привет, Алишер', date: '27 апреля, понедельник',
    profit: 'Прибыль сегодня', stock: 'На витрине', frozen: 'Заморожено', debts: 'Долги Nasiya',
    items: 'устр.',
    payments: 'Платежи сегодня', buy: '+ Купил', sell: '+ Продал',
    overdue: 'просрочено', today: 'сегодня', tomorrow: 'завтра',
  };
  const stats = [
    { k: 'profit', icon: <IconMoney size={20}/>, label: t.profit, value: fmtSigned(850000), kind: 'green', big: true },
    { k: 'stock', icon: <IconBox size={20}/>, label: t.stock, value: '12', sub: t.items, kind: 'blue' },
    { k: 'frozen', icon: <IconSnowflake size={20}/>, label: t.frozen, value: fmtUZS(18400000), kind: 'yellow', small: true },
    { k: 'debts', icon: <IconClipboard size={20}/>, label: t.debts, value: fmtUZS(3400000), kind: 'red', small: true },
  ];
  const payments = [
    { name: 'Жасур Каримов', device: 'Galaxy A55', amount: 250000, status: 'today', tone: 'yellow' },
    { name: 'Бахром Юсупов', device: 'iPhone 13', amount: 480000, status: 'overdue', days: 3, tone: 'red' },
    { name: 'Шохрух Назаров', device: 'Redmi Note 12', amount: 150000, status: 'today', tone: 'yellow' },
    { name: 'Дилшод Ахмедов', device: 'iPad Air', amount: 320000, status: 'today', tone: 'yellow' },
  ];

  return (
    <Screen theme={theme}>
      <div style={{
        padding: '52px 16px 14px', background: theme.bg,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: theme.textDim }}>{t.date}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: theme.text, letterSpacing: -0.4, marginTop: 2 }}>{t.greet}</div>
        </div>
        <button style={iconBtn(theme)}><IconSearch size={22}/></button>
        <button style={iconBtn(theme, theme.accent)}><IconQr size={22}/></button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px 16px' }}>
        {/* 2x2 stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          {stats.map(s => {
            const c = theme.status[s.kind];
            return (
              <div key={s.k} style={{
                background: theme.bg3, border: `1px solid ${theme.border}`,
                borderRadius: 16, padding: 14, position: 'relative',
                minHeight: 96,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: c.text, marginBottom: 8 }}>
                  {s.icon}
                  <span style={{ fontSize: 12, fontWeight: 600, color: theme.textDim }}>{s.label}</span>
                </div>
                <div style={{
                  fontSize: s.small ? 17 : (s.big ? 22 : 26),
                  fontWeight: 700, color: s.kind === 'green' ? c.text : theme.text,
                  letterSpacing: -0.4, fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.1,
                }}>{s.value}</div>
                {s.sub && <div style={{ fontSize: 12, color: theme.textDim, marginTop: 2 }}>{s.sub}</div>}
              </div>
            );
          })}
        </div>

        <SectionTitle theme={theme}>{t.payments}</SectionTitle>
        <Card theme={theme} padding={0} style={{ marginBottom: 16 }}>
          {payments.map((p, i) => {
            const c = theme.status[p.tone];
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px',
                borderBottom: i < payments.length - 1 ? `1px solid ${theme.border}` : 'none',
              }}>
                <Avatar initials={p.name.split(' ').map(s=>s[0]).join('').slice(0,2)} color={['#3B82F6','#10B981','#F59E0B','#8B5CF6'][i%4]}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: theme.text, letterSpacing: -0.1 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: theme.textDim, marginTop: 1 }}>
                    {p.device} · {p.status === 'overdue' ? <span style={{ color: c.text, fontWeight: 600 }}>{p.days} дн. {t.overdue}</span> : t.today}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{fmtUZS(p.amount)}</div>
                </div>
                <button style={{
                  width: 40, height: 40, borderRadius: 20, border: 'none',
                  background: theme.status.green.bg, color: theme.status.green.text,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}><IconPhoneCall size={18}/></button>
              </div>
            );
          })}
        </Card>
      </div>

      {/* sticky CTA pair */}
      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 10, background: theme.bg }}>
        <Button theme={theme} size="lg" full icon={<IconPlus size={20}/>}>{t.buy}</Button>
        <Button theme={theme} size="lg" full variant="secondary" icon={<IconPlus size={20}/>}>{t.sell}</Button>
      </div>

      <BottomNav theme={theme} active="home" isAdmin={isAdmin} lang={lang}/>
    </Screen>
  );
}

function iconBtn(theme, color) {
  return {
    width: 44, height: 44, borderRadius: 22, border: 'none',
    background: theme.bg2, color: color || theme.text,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    flexShrink: 0,
  };
}

// =========================================================
// 3. ВИТРИНА (stock list)
// =========================================================
function ScreenStock({ theme, lang, isAdmin }) {
  const t = lang === 'uz' ? {
    title: 'Vitrina', sub: '12 qurilma · 18 400 000 so\'m',
    all: 'Barchasi', phones: 'Telefon', tablets: 'Planshet', laptops: 'Noutbuk',
    long: '⚠ Uzoq turibdi', daysAgo: 'kun oldin',
    sell: 'Sotish', writeoff: 'Hisobdan chiqarildi',
    search: 'IMEI, model yoki ism...',
  } : {
    title: 'Витрина', sub: '12 устройств · 18 400 000 сум',
    all: 'Все', phones: 'Телефоны', tablets: 'Планшеты', laptops: 'Ноутбуки',
    long: '⚠ Долго лежит', daysAgo: 'дн.',
    sell: 'Продать', writeoff: 'Списать',
    search: 'IMEI, модель или имя...',
  };
  const items = [
    { cat: 'phone', brand: 'Samsung', model: 'Galaxy A55 5G 256GB', imei: '356218115473921', price: 4200000, days: 3, color: 'Awesome Navy' },
    { cat: 'phone', brand: 'Apple', model: 'iPhone 13 128GB', imei: '356218115482133', price: 6800000, days: 8, color: 'Midnight' },
    { cat: 'phone', brand: 'Xiaomi', model: 'Redmi Note 12 Pro', imei: '356218115493847', price: 2400000, days: 18, long: true, color: 'Sky Blue' },
    { cat: 'tablet', brand: 'Apple', model: 'iPad Air 11" M2 256GB', imei: '356218115503712', price: 9200000, days: 1, color: 'Space Gray' },
    { cat: 'phone', brand: 'Samsung', model: 'Galaxy S24 Ultra 512GB', imei: '356218115518932', price: 12800000, days: 5, color: 'Titanium Black' },
    { cat: 'laptop', brand: 'Apple', model: 'MacBook Air 13" M3', imei: 'C02F45HXJG5J', price: 14500000, days: 21, long: true, color: 'Starlight' },
  ];

  return (
    <Screen theme={theme}>
      <TopBar theme={theme} title={t.title} sub={t.sub}
        right={<><button style={iconBtn(theme)}><IconSearch size={20}/></button><button style={iconBtn(theme, theme.accent)}><IconQr size={20}/></button></>}
      />

      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* search input */}
        <div style={{ padding: '12px 16px 8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: theme.bg2, borderRadius: 14, padding: '0 14px', height: 44,
            border: `1px solid ${theme.border}`,
          }}>
            <IconSearch size={18} stroke={theme.textDim}/>
            <span style={{ flex: 1, color: theme.textMuted, fontSize: 15 }}>{t.search}</span>
          </div>
        </div>

        {/* filter chips */}
        <div style={{ display: 'flex', gap: 8, padding: '6px 16px 12px', overflowX: 'auto' }}>
          <Chip theme={theme} active>{t.all} · 12</Chip>
          <Chip theme={theme}>{t.phones} · 9</Chip>
          <Chip theme={theme}>{t.tablets} · 2</Chip>
          <Chip theme={theme}>{t.laptops} · 1</Chip>
        </div>

        {/* list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 16px 16px' }}>
          {items.map((it, i) => (
            <Card key={i} theme={theme} padding={14}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: theme.bg2, color: theme.textDim,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <DeviceIcon category={it.cat} size={26}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: theme.text, letterSpacing: -0.2 }}>{it.brand} {it.model}</div>
                  </div>
                  <div style={{ fontSize: 12, color: theme.textDim, fontFamily: window.MALIKA.mono, marginTop: 2, letterSpacing: 0.2 }}>{it.imei}</div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{it.color}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{fmtUZS(it.price)}</div>
                    {it.long
                      ? <StatusBadge theme={theme} kind="yellow" dot>{it.days} {t.daysAgo}</StatusBadge>
                      : <span style={{ fontSize: 12, color: theme.textDim }}><IconClock size={13} style={{ verticalAlign: -2, marginRight: 4 }}/>{it.days} {t.daysAgo}</span>
                    }
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <BottomNav theme={theme} active="stock" isAdmin={isAdmin} lang={lang}/>
    </Screen>
  );
}

// =========================================================
// 4. + КУПИЛ (purchase form)
// =========================================================
function ScreenBuy({ theme, lang, isAdmin }) {
  const t = lang === 'uz' ? {
    title: "Sotib olish", category: 'Toifa', brand: 'Brend va model',
    imei: 'IMEI', scan: 'Skaner', price: 'Sotib olish narxi',
    state: 'Holati', states: ['Yangi', 'Yaxshi', "Normal", 'Buzilgan'],
    seller: 'Sotuvchi', sellerPh: 'Ism va telefon',
    passport: 'Pasport rasmi',  comment: 'Izoh',
    add: 'Qo\'shimcha', save: "Saqlash",
    autocomplete: ['Galaxy A55', 'Galaxy S24', 'Galaxy A35'],
  } : {
    title: 'Закупка', category: 'Категория', brand: 'Бренд и модель',
    imei: 'IMEI', scan: 'Сканер', price: 'Цена закупа',
    state: 'Состояние', states: ['Новый', 'Хороший', 'Норм', 'Битый'],
    seller: 'Продавец', sellerPh: 'Имя и телефон',
    passport: 'Фото паспорта', comment: 'Комментарий',
    add: 'Дополнительно', save: 'Сохранить закупку',
    autocomplete: ['Galaxy A55', 'Galaxy S24', 'Galaxy A35'],
  };
  const cats = [
    { k: 'phone', I: IconPhone, l: lang==='uz'?'Telefon':'Телефон' },
    { k: 'tablet', I: IconTablet, l: lang==='uz'?'Planshet':'Планшет' },
    { k: 'laptop', I: IconLaptop, l: lang==='uz'?'Noutbuk':'Ноутбук' },
    { k: 'other', I: IconHeadphones, l: lang==='uz'?'Boshqa':'Другое' },
  ];

  return (
    <Screen theme={theme}>
      <TopBar theme={theme} title={t.title} onBack
        right={<button style={iconBtn(theme)}><IconX size={20}/></button>}
      />
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ fontSize: 13, color: theme.textDim, fontWeight: 500, marginBottom: 10 }}>{t.category}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            {cats.map((c, i) => (
              <CategoryTile key={c.k} theme={theme} active={i===0} icon={<c.I size={28}/>} label={c.l}/>
            ))}
          </div>
        </div>

        <Field theme={theme} label={t.brand} value="Samsung Galaxy A55 5G" hint={lang==='uz'?'Avtotanlash:':'Автокомплит:'}/>

        <div>
          <div style={{ fontSize: 13, color: theme.textDim, fontWeight: 500, marginBottom: 6 }}>{t.imei}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Field theme={theme} value="356218115473921" mono/>
            </div>
            <button style={{
              width: 56, height: 48, borderRadius: 12, border: 'none',
              background: theme.accent, color: theme.onAccent,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              flexShrink: 0,
            }}><IconCamera size={24}/></button>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, color: theme.textDim, fontWeight: 500, marginBottom: 6 }}>{t.price}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Field theme={theme} value="4 200 000" big suffix="UZS"/>
            </div>
            <div style={{
              display: 'flex', borderRadius: 12, overflow: 'hidden',
              border: `1px solid ${theme.border}`, background: theme.bg2,
            }}>
              <button style={segBtn(theme, true)}>UZS</button>
              <button style={segBtn(theme, false)}>USD</button>
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, color: theme.textDim, fontWeight: 500, marginBottom: 8 }}>{t.state}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {t.states.map((s, i) => <Chip key={s} theme={theme} active={i===1}>{s}</Chip>)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, color: theme.textDim, fontWeight: 500, marginBottom: 6 }}>{t.seller}</div>
          <Card theme={theme} padding={12} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar initials="ЖК" color="#10B981"/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Жасур Каримов</div>
              <div style={{ fontSize: 13, color: theme.textDim, fontFamily: window.MALIKA.mono }}>+998 90 123 45 67</div>
            </div>
            <IconChevR size={18} stroke={theme.textDim}/>
          </Card>
        </div>

        <button style={{
          padding: '14px 16px', borderRadius: 12,
          background: theme.bg2, border: `1.5px dashed ${theme.borderStrong}`,
          color: theme.text, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
        }}>
          <IconImage size={22} stroke={theme.accent}/>
          <span style={{ fontSize: 14, fontWeight: 600, flex: 1, textAlign: 'left' }}>{t.passport}</span>
          <span style={{ fontSize: 12, color: theme.textDim }}>JPG/PNG</span>
        </button>

        <div>
          <div style={{ fontSize: 13, color: theme.textDim, fontWeight: 500, marginBottom: 6 }}>{t.comment}</div>
          <Field theme={theme} value={lang==='uz' ? "Korobkasi bor, original" : "Коробка есть, оригинал"} multiline/>
        </div>
      </div>

      <div style={{ padding: '12px 16px 12px', background: theme.bg, borderTop: `1px solid ${theme.border}` }}>
        <Button theme={theme} size="lg" full>{t.save}</Button>
      </div>
    </Screen>
  );
}

function segBtn(theme, on) {
  return {
    border: 'none', padding: '0 14px', height: 48,
    background: on ? theme.accent : 'transparent',
    color: on ? theme.onAccent : theme.text,
    fontFamily: 'inherit', fontWeight: 700, fontSize: 14, cursor: 'pointer',
  };
}

// =========================================================
// 5. + ПРОДАЛ (sell form)
// =========================================================
function ScreenSell({ theme, lang, isAdmin }) {
  const t = lang === 'uz' ? {
    title: 'Sotish', selectDevice: 'Qurilma', sellPrice: 'Sotish narxi',
    buyer: 'Xaridor', cash: 'Naqd', nasiya: 'Nasiya',
    type: "To'lov turi", advance: 'Birinchi badal', term: 'Muddat',
    schedule: "To'lov jadvali", every: 'har oy',
    months: 'oy', save: 'Sotuvni saqlash',
    profit: 'Foyda',
  } : {
    title: 'Продажа', selectDevice: 'Устройство', sellPrice: 'Цена продажи',
    buyer: 'Покупатель', cash: 'Наличные', nasiya: 'Nasiya',
    type: 'Тип оплаты', advance: 'Первый взнос', term: 'Срок',
    schedule: 'График платежей', every: 'каждый месяц',
    months: 'мес', save: 'Сохранить продажу',
    profit: 'Прибыль',
  };
  const sched = [
    { d: '01.06', a: 1500000, k: 0 },
    { d: '01.07', a: 1500000, k: 1 },
    { d: '01.08', a: 1500000, k: 2 },
    { d: '01.09', a: 1500000, k: 3 },
  ];

  return (
    <Screen theme={theme}>
      <TopBar theme={theme} title={t.title} onBack right={<button style={iconBtn(theme)}><IconX size={20}/></button>}/>
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ fontSize: 13, color: theme.textDim, fontWeight: 500, marginBottom: 6 }}>{t.selectDevice}</div>
          <Card theme={theme} padding={12} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: theme.bg2, color: theme.textDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DeviceIcon category="phone" size={24}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Samsung Galaxy A55 5G</div>
              <div style={{ fontSize: 11, color: theme.textDim, fontFamily: window.MALIKA.mono }}>356218115473921</div>
              <div style={{ fontSize: 12, color: theme.textDim, marginTop: 2 }}>{lang==='uz'?'Sotib olindi:':'Закуп:'} {fmtUZS(4200000)}</div>
            </div>
            <button style={{ ...iconBtn(theme, theme.accent), width: 40, height: 40 }}><IconQr size={20}/></button>
          </Card>
        </div>

        <Field theme={theme} label={t.sellPrice} value="6 000 000" big suffix="UZS"/>

        <div>
          <div style={{ fontSize: 13, color: theme.textDim, fontWeight: 500, marginBottom: 6 }}>{t.buyer}</div>
          <Card theme={theme} padding={12} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar initials="БЮ" color="#F59E0B"/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Бахром Юсупов</div>
              <div style={{ fontSize: 13, color: theme.textDim, fontFamily: window.MALIKA.mono }}>+998 93 456 78 90</div>
            </div>
            <IconChevR size={18} stroke={theme.textDim}/>
          </Card>
        </div>

        <div>
          <div style={{ fontSize: 13, color: theme.textDim, fontWeight: 500, marginBottom: 8 }}>{t.type}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button style={paymentTile(theme, false)}>
              <IconMoney size={28}/>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{t.cash}</div>
              <div style={{ fontSize: 11, color: theme.textDim, marginTop: 1 }}>{lang==='uz'?"To'liq to'lov":'Полная оплата'}</div>
            </button>
            <button style={paymentTile(theme, true)}>
              <IconCalendar size={28}/>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{t.nasiya}</div>
              <div style={{ fontSize: 11, marginTop: 1, opacity: 0.85 }}>{lang==='uz'?"Bo'lib to'lash":'В рассрочку'}</div>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field theme={theme} label={t.advance} value="500 000" suffix="UZS"/>
          <Field theme={theme} label={t.term} value="4" suffix={t.months}/>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: theme.textDim, fontWeight: 500 }}>{t.schedule}</span>
            <span style={{ fontSize: 12, color: theme.textMuted }}>{t.every}</span>
          </div>
          <Card theme={theme} padding={0}>
            {sched.map((s, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px',
                borderBottom: i < sched.length-1 ? `1px solid ${theme.border}` : 'none',
              }}>
                <div style={{ width: 26, height: 26, borderRadius: 13, background: theme.bg2, color: theme.textDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{i+1}</div>
                <div style={{ flex: 1, fontSize: 14, color: theme.textDim, fontFamily: window.MALIKA.mono }}>{s.d}</div>
                <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtUZS(s.a)}</div>
              </div>
            ))}
          </Card>
        </div>

        {/* profit preview */}
        <div style={{
          background: theme.status.green.bg, color: theme.status.green.text,
          border: `1px solid ${theme.status.green.border}`, borderRadius: 14,
          padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{t.profit}</span>
          <span style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtSigned(1800000)}</span>
        </div>
      </div>

      <div style={{ padding: '12px 16px', background: theme.bg, borderTop: `1px solid ${theme.border}` }}>
        <Button theme={theme} size="lg" full>{t.save}</Button>
      </div>
    </Screen>
  );
}

function paymentTile(theme, on) {
  return {
    fontFamily: 'inherit', cursor: 'pointer', minHeight: 96,
    background: on ? theme.accent : theme.bg2,
    color: on ? theme.onAccent : theme.text,
    border: `1.5px solid ${on ? 'transparent' : theme.border}`,
    borderRadius: 14, padding: 14,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  };
}

// =========================================================
// 6. КАРТОЧКА УСТРОЙСТВА (device card with timeline)
// =========================================================
function ScreenDevice({ theme, lang, isAdmin }) {
  const t = lang === 'uz' ? {
    title: 'Qurilma', sold: 'Sotildi', stock: 'Vitrinada',
    purchase: 'SOTIB OLINDI', shelf: 'VITRINA', sale: 'SOTILDI', nasiya: 'NASIYA',
    days: 'kun', daysShelf: 'kun turdi',
    profit: 'Foyda', price: 'Narx', seller: 'Sotuvchi', buyer: 'Xaridor',
    paid: 'to\'langan', pending: 'kutilmoqda', late: 'kechikdi',
    print: 'QR chop etish', edit: 'Tahrirlash', refund: 'Qaytarish',
  } : {
    title: 'Устройство', sold: 'Продан', stock: 'На витрине',
    purchase: 'ЗАКУП', shelf: 'НА ВИТРИНЕ', sale: 'ПРОДАЖА', nasiya: 'NASIYA',
    days: 'дн.', daysShelf: 'дн. лежал',
    profit: 'Прибыль', price: 'Цена', seller: 'Продавец', buyer: 'Покупатель',
    paid: 'оплачено', pending: 'ожидается', late: 'просрочено',
    print: 'Стикер QR', edit: 'Изменить', refund: 'Возврат',
  };
  const payments = [
    { d: '26.04', n: lang==='uz'?'Birinchi badal':'Первый взнос', a: 500000, st: 'paid' },
    { d: '01.06', n: lang==='uz'?"To'lov 1/4":'Платёж 1/4', a: 1500000, st: 'paid' },
    { d: '01.07', n: lang==='uz'?"To'lov 2/4":'Платёж 2/4', a: 1500000, st: 'pending' },
    { d: '01.08', n: lang==='uz'?"To'lov 3/4":'Платёж 3/4', a: 1500000, st: 'late', days: 5 },
    { d: '01.09', n: lang==='uz'?"To'lov 4/4":'Платёж 4/4', a: 1500000, st: 'pending' },
  ];

  return (
    <Screen theme={theme}>
      <TopBar theme={theme} title={t.title} onBack right={<button style={iconBtn(theme)}><IconMore size={20}/></button>}/>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* hero */}
        <div style={{ padding: '14px 16px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{
            width: 84, height: 84, borderRadius: 16,
            background: theme.bg2, color: theme.textDim,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${theme.border}`,
          }}>
            <DeviceIcon category="phone" size={48}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>Samsung Galaxy A55</div>
            <div style={{ fontSize: 14, color: theme.textDim, marginTop: 2 }}>5G · 256GB · Awesome Navy</div>
            <div style={{ fontSize: 12, color: theme.textMuted, fontFamily: window.MALIKA.mono, marginTop: 4, letterSpacing: 0.2 }}>356218115473921</div>
            <div style={{ marginTop: 8 }}>
              <StatusBadge theme={theme} kind="blue" dot>{t.sold} · Nasiya</StatusBadge>
            </div>
          </div>
        </div>

        {/* timeline */}
        <div style={{ padding: '0 16px 16px' }}>
          <Timeline theme={theme}>
            <TimelineRow theme={theme} kind="green" icon={<IconCash size={18}/>} title={t.purchase} sub="03.04 · Жасур Каримов · +998 90 123 45 67">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, color: theme.textDim }}>{t.price}</span>
                <span style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtUZS(4200000)}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <div style={{ width: 44, height: 56, borderRadius: 8, background: `linear-gradient(135deg, ${theme.bg2}, ${theme.border})`, border: `1px solid ${theme.border}` }}/>
                <div style={{ width: 44, height: 56, borderRadius: 8, background: `linear-gradient(135deg, ${theme.bg2}, ${theme.border})`, border: `1px solid ${theme.border}` }}/>
                <div style={{ flex: 1, fontSize: 11, color: theme.textMuted, alignSelf: 'flex-end' }}>{lang==='uz'?'Pasport rasmi':'Фото паспорта'}</div>
              </div>
            </TimelineRow>
            <TimelineRow theme={theme} kind="yellow" icon={<IconClock size={18}/>} title={t.shelf} sub={`8 ${t.daysShelf}`}/>
            <TimelineRow theme={theme} kind="blue" icon={<IconCheck size={18}/>} title={t.sale} sub="11.04 · Бахром Юсупов · +998 93 456 78 90">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, color: theme.textDim }}>{t.price}</span>
                <span style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtUZS(6000000)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
                <span style={{ fontSize: 12, color: theme.status.green.text }}>{t.profit}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: theme.status.green.text, fontVariantNumeric: 'tabular-nums' }}>{fmtSigned(1800000)}</span>
              </div>
            </TimelineRow>
            <TimelineRow theme={theme} kind="blue" icon={<IconCalendar size={18}/>} title={t.nasiya} sub={lang==='uz'?'4 oy · har oyning 1-i':'4 мес · 1-е числа'} last>
              {payments.map((p, i) => {
                const cmap = { paid: 'green', pending: 'gray', late: 'red' };
                const c = theme.status[cmap[p.st]];
                const ic = p.st === 'paid' ? <IconCheck size={14}/> : p.st === 'late' ? <IconAlert size={14}/> : <IconClock size={14}/>;
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 0',
                    borderBottom: i < payments.length-1 ? `1px solid ${theme.border}` : 'none',
                  }}>
                    <div style={{ width: 22, height: 22, borderRadius: 11, background: c.bg, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ic}</div>
                    <div style={{ width: 48, fontSize: 12, color: theme.textDim, fontFamily: window.MALIKA.mono }}>{p.d}</div>
                    <div style={{ flex: 1, fontSize: 13, color: theme.text }}>{p.n}</div>
                    {p.st === 'late' && <span style={{ fontSize: 11, color: c.text, fontWeight: 700 }}>{p.days} {t.days}</span>}
                    <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: p.st==='paid' ? theme.textDim : theme.text, textDecoration: p.st==='paid' ? 'line-through' : 'none' }}>{fmtUZS(p.a)}</div>
                  </div>
                );
              })}
            </TimelineRow>
          </Timeline>
        </div>
      </div>

      <div style={{ padding: '10px 16px 12px', display: 'flex', gap: 8, background: theme.bg, borderTop: `1px solid ${theme.border}` }}>
        <Button theme={theme} variant="secondary" size="md" full icon={<IconPrint size={18}/>}>{t.print}</Button>
        <Button theme={theme} variant="secondary" size="md" full icon={<IconRefund size={18}/>} danger>{t.refund}</Button>
      </div>
    </Screen>
  );
}

function Timeline({ theme, children }) {
  return <div style={{ position: 'relative', paddingLeft: 4 }}>{children}</div>;
}
function TimelineRow({ theme, kind, icon, title, sub, children, last }) {
  const c = theme.status[kind];
  return (
    <div style={{ display: 'flex', gap: 12, paddingBottom: last ? 0 : 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 16, background: c.bg, color: c.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1.5px solid ${c.border}`,
        }}>{icon}</div>
        {!last && <div style={{ flex: 1, width: 2, background: theme.border, marginTop: 2 }}/>}
      </div>
      <div style={{ flex: 1, paddingTop: 2 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: c.text }}>{title}</div>
        {sub && <div style={{ fontSize: 13, color: theme.textDim, marginTop: 1 }}>{sub}</div>}
        {children && <div style={{ marginTop: 8, padding: '10px 12px', background: theme.bg2, borderRadius: 12, border: `1px solid ${theme.border}` }}>{children}</div>}
      </div>
    </div>
  );
}

Object.assign(window, {
  ScreenSplash, ScreenToday, ScreenStock, ScreenBuy, ScreenSell, ScreenDevice,
});
