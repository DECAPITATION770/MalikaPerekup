// screens-app2.jsx — Mini App screens 7-12
// 7 Nasiya list, 8 Nasiya card, 9 Reports, 10 Search, 11 Scanner, 12 Settings

const { Screen, TopBar, BottomNav, Card, StatusBadge, Button, Chip,
  Field, ProgressBar, Avatar, DeviceIcon, SectionTitle,
  fmtUZS, fmtUSD, fmtSigned } = window;
const { IconSearch, IconQr, IconPhoneCall, IconAlert, IconClock, IconCheck,
  IconChevR, IconArrowL, IconMore, IconX, IconBox, IconCash, IconCalendar,
  IconUser, IconUsers, IconShield, IconKey, IconLogOut, IconStore, IconBell,
  IconLang, IconHelp, IconFilter, IconPlus, IconChart, IconStar, IconPhone,
  IconTablet, IconSettings, IconCamera, IconClipboard } = window;

function iconBtn(theme, color) {
  return {
    width: 44, height: 44, borderRadius: 22, border: 'none',
    background: theme.bg2, color: color || theme.text,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    flexShrink: 0,
  };
}

// =========================================================
// 7. NASIYA list
// =========================================================
function ScreenNasiya({ theme, lang, isAdmin }) {
  const t = lang === 'uz' ? {
    title: 'Nasiya', sub: 'Faol: 12 · Jami qarz',
    all: 'Barchasi', active: 'Faol', overdue: 'Kechikkan',
    next: 'Keyingi', overdueLbl: 'kechikdi',
    paid: "to'langan", days: 'kun',
  } : {
    title: 'Nasiya', sub: 'Активных: 12 · Общий долг',
    all: 'Все · 12', active: 'Активные · 9', overdue: 'Просрочены · 3',
    next: 'Следующий', overdueLbl: 'просрочено',
    paid: 'оплачено', days: 'дн.',
  };
  const items = [
    { name: 'Бахром Юсупов', dev: 'Samsung Galaxy A55', total: 6000000, paid: 2000000, next: '01.07', overdue: 0, color: '#F59E0B', initials: 'БЮ' },
    { name: 'Жасур Каримов', dev: 'iPhone 13 128GB', total: 8200000, paid: 6500000, next: '15.07', overdue: 0, color: '#10B981', initials: 'ЖК' },
    { name: 'Шохрух Назаров', dev: 'Redmi Note 12 Pro', total: 3000000, paid: 750000, next: '22.04', overdue: 5, color: '#3B82F6', initials: 'ШН' },
    { name: 'Дилшод Ахмедов', dev: 'iPad Air 11"', total: 11000000, paid: 4400000, next: '01.07', overdue: 0, color: '#8B5CF6', initials: 'ДА' },
    { name: 'Рустам Холматов', dev: 'Galaxy S24 Ultra', total: 14500000, paid: 3000000, next: '18.04', overdue: 9, color: '#DC4F3F', initials: 'РХ' },
    { name: 'Сардор Алиев', dev: 'MacBook Air M3', total: 18000000, paid: 12000000, next: '01.08', overdue: 0, color: '#06B6D4', initials: 'СА' },
  ];
  return (
    <Screen theme={theme}>
      <TopBar theme={theme} title={t.title}
        right={<><button style={iconBtn(theme)}><IconSearch size={20}/></button><button style={iconBtn(theme)}><IconFilter size={20}/></button></>}
      />
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ padding: '14px 16px 8px' }}>
          <Card theme={theme} padding={14} style={{ background: theme.status.red.bg, border: `1px solid ${theme.status.red.border}` }}>
            <div style={{ fontSize: 12, color: theme.status.red.text, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{t.sub}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: theme.status.red.text, fontVariantNumeric: 'tabular-nums', marginTop: 4, letterSpacing: -0.4 }}>{fmtUZS(45200000)}</div>
            <div style={{ fontSize: 12, color: theme.status.red.text, opacity: 0.8, marginTop: 2 }}>3 {lang==='uz'?"kechikkan to'lov":'просроченных платежа'}</div>
          </Card>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '4px 16px 12px', overflowX: 'auto' }}>
          <Chip theme={theme} active>{t.all}</Chip>
          <Chip theme={theme}>{t.active}</Chip>
          <Chip theme={theme}>{t.overdue}</Chip>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 16px 16px' }}>
          {items.map((it, i) => {
            const pct = (it.paid / it.total) * 100;
            const remain = it.total - it.paid;
            const tone = it.overdue > 0 ? 'red' : pct > 80 ? 'green' : 'blue';
            const c = theme.status[tone];
            return (
              <Card key={i} theme={theme} padding={14}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <Avatar initials={it.initials} color={it.color} size={42}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>{it.name}</div>
                      {it.overdue > 0 && <StatusBadge theme={theme} kind="red" dot size="sm">{it.overdue} {t.days} {t.overdueLbl}</StatusBadge>}
                    </div>
                    <div style={{ fontSize: 12, color: theme.textDim, marginTop: 1 }}>{it.dev}</div>
                    <div style={{ marginTop: 10 }}>
                      <ProgressBar theme={theme} value={pct} kind={tone}/>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: theme.textDim }}>{fmtUZS(it.paid)} / {fmtUZS(it.total)}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: c.text, fontVariantNumeric: 'tabular-nums' }}>{fmtUZS(remain)}</span>
                      </div>
                      <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>{t.next}: <span style={{ color: c.text, fontWeight: 600 }}>{it.next}</span></div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
      <BottomNav theme={theme} active="nasiya" isAdmin={isAdmin} lang={lang}/>
    </Screen>
  );
}

// =========================================================
// 8. NASIYA card
// =========================================================
function ScreenNasiyaCard({ theme, lang, isAdmin }) {
  const t = lang === 'uz' ? {
    title: 'Nasiya', remaining: "Qoldi to'lash", paid: "To'langan",
    schedule: "To'lov jadvali",
    accept: "To'lovni qabul qilish", close: 'Muddatdan oldin yopish',
    call: "Xaridorga qo'ng'iroq",
    paidL: 'oplangan', late: 'kechikdi', days: 'kun',
    advance: 'Birinchi badal',
  } : {
    title: 'Nasiya', remaining: 'Остаток', paid: 'Оплачено',
    schedule: 'График платежей',
    accept: 'Принять платёж', close: 'Закрыть досрочно',
    call: 'Позвонить покупателю',
    paidL: 'оплачено', late: 'просрочено', days: 'дн.',
    advance: 'Первый взнос',
  };
  const sched = [
    { d: '26.04', n: t.advance, a: 500000, st: 'paid' },
    { d: '01.06', n: lang==='uz'?"To'lov 1/4":'Платёж 1/4', a: 1500000, st: 'paid' },
    { d: '01.07', n: lang==='uz'?"To'lov 2/4":'Платёж 2/4', a: 1500000, st: 'pending' },
    { d: '01.08', n: lang==='uz'?"To'lov 3/4":'Платёж 3/4', a: 1500000, st: 'late', days: 5 },
    { d: '01.09', n: lang==='uz'?"To'lov 4/4":'Платёж 4/4', a: 1500000, st: 'pending' },
  ];
  const total = 6500000, paidAmt = 2000000;

  return (
    <Screen theme={theme}>
      <TopBar theme={theme} title={t.title} onBack right={<button style={iconBtn(theme)}><IconMore size={20}/></button>}/>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar initials="БЮ" color="#F59E0B" size={56}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>Бахром Юсупов</div>
            <div style={{ fontSize: 13, color: theme.textDim, fontFamily: window.MALIKA.mono, marginTop: 2 }}>+998 93 456 78 90</div>
            <div style={{ fontSize: 13, color: theme.textDim, marginTop: 4 }}>Samsung Galaxy A55 5G · 256GB</div>
          </div>
        </div>

        <div style={{ padding: '0 16px 14px' }}>
          <Card theme={theme} padding={14}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 12, color: theme.textDim, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{t.remaining}</span>
              <span style={{ fontSize: 11, color: theme.textMuted }}>{t.paid}: {fmtUZS(paidAmt)}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5, marginTop: 4 }}>{fmtUZS(total - paidAmt)}</div>
            <div style={{ marginTop: 10 }}><ProgressBar theme={theme} value={(paidAmt/total)*100} kind="red" height={8}/></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 11, color: theme.textDim }}>{Math.round((paidAmt/total)*100)}% {t.paidL}</span>
              <span style={{ fontSize: 11, color: theme.textMuted }}>{fmtUZS(total)}</span>
            </div>
          </Card>
        </div>

        <SectionTitle theme={theme}>{t.schedule}</SectionTitle>
        <div style={{ padding: '0 16px 16px' }}>
          <Card theme={theme} padding={0}>
            {sched.map((p, i) => {
              const cmap = { paid: 'green', pending: 'gray', late: 'red' };
              const c = theme.status[cmap[p.st]];
              const ic = p.st === 'paid' ? <IconCheck size={16}/> : p.st === 'late' ? <IconAlert size={16}/> : <IconClock size={16}/>;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px',
                  borderBottom: i < sched.length-1 ? `1px solid ${theme.border}` : 'none',
                  background: p.st === 'late' ? theme.status.red.bg : 'transparent',
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: 14, background: c.bg, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${c.border}` }}>{ic}</div>
                  <div style={{ width: 50, fontSize: 12, color: theme.textDim, fontFamily: window.MALIKA.mono, fontWeight: 600 }}>{p.d}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: theme.text, fontWeight: 500 }}>{p.n}</div>
                    {p.st === 'late' && <div style={{ fontSize: 11, color: c.text, fontWeight: 700, marginTop: 1 }}>{p.days} {t.days} {t.late}</div>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                    color: p.st==='paid' ? theme.textDim : theme.text,
                    textDecoration: p.st==='paid' ? 'line-through' : 'none',
                  }}>{fmtUZS(p.a)}</div>
                </div>
              );
            })}
          </Card>
        </div>

        <div style={{ padding: '0 16px 16px' }}>
          <button style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '12px 14px', borderRadius: 12, border: 'none',
            background: theme.status.green.bg, color: theme.status.green.text, cursor: 'pointer',
            fontFamily: 'inherit', fontWeight: 600, fontSize: 14,
          }}>
            <IconPhoneCall size={18}/> {t.call}
          </button>
        </div>
      </div>

      <div style={{ padding: '10px 16px 12px', display: 'flex', gap: 8, background: theme.bg, borderTop: `1px solid ${theme.border}` }}>
        <Button theme={theme} size="lg" full>{t.accept}</Button>
        <Button theme={theme} variant="secondary" size="lg" full>{t.close}</Button>
      </div>
    </Screen>
  );
}

// =========================================================
// 9. ОТЧЁТЫ
// =========================================================
function ScreenReports({ theme, lang, isAdmin }) {
  const t = lang === 'uz' ? {
    title: 'Hisobotlar',
    today: 'Bugun', d7: '7 kun', d30: '30 kun', custom: 'Tanlash',
    revenue: 'Tushum', profit: 'Foyda', purchases: 'Sotib olishlar', sales: 'Sotuvlar', returns: 'Qaytarishlar',
    topModels: "Foyda bo'yicha top modellar", avg: "O'rtacha saqlash muddati",
    days: 'kun', export: 'Excelga eksport',
    margin: 'marja',
  } : {
    title: 'Отчёты',
    today: 'Сегодня', d7: '7 дней', d30: '30 дней', custom: 'Период',
    revenue: 'Выручка', profit: 'Прибыль', purchases: 'Закупки', sales: 'Продажи', returns: 'Возвраты',
    topModels: 'Топ моделей по марже', avg: 'Средняя длительность хранения',
    days: 'дн.', export: 'Экспорт в Excel',
    margin: 'маржа',
  };
  const tops = [
    { cat: 'phone', n: 'iPhone 13', sold: 8, profit: 14400000 },
    { cat: 'phone', n: 'Galaxy A55', sold: 6, profit: 10800000 },
    { cat: 'tablet', n: 'iPad Air 11"', sold: 3, profit: 7200000 },
    { cat: 'phone', n: 'Redmi Note 12', sold: 5, profit: 4500000 },
    { cat: 'laptop', n: 'MacBook Air M3', sold: 2, profit: 5800000 },
  ];
  return (
    <Screen theme={theme}>
      <TopBar theme={theme} title={t.title}/>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ display: 'flex', gap: 6, padding: '12px 16px', overflowX: 'auto' }}>
          <Chip theme={theme}>{t.today}</Chip>
          <Chip theme={theme}>{t.d7}</Chip>
          <Chip theme={theme} active>{t.d30}</Chip>
          <Chip theme={theme}>{t.custom}</Chip>
        </div>

        <div style={{ padding: '0 16px 14px' }}>
          <Card theme={theme} padding={16}>
            <div style={{ fontSize: 12, color: theme.textDim, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{t.profit}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: theme.status.green.text, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.6, marginTop: 4 }}>{fmtSigned(38400000)}</div>
            <div style={{ fontSize: 13, color: theme.textDim, marginTop: 2 }}>{lang==='uz'?'Oktyabr 2026':'апрель 2026'}</div>

            {/* sparkline-ish 30 day bar chart */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60, marginTop: 14 }}>
              {Array.from({length: 30}).map((_, i) => {
                const h = 20 + Math.abs(Math.sin(i*0.7)*30) + (i%5===0 ? 15 : 0);
                return <div key={i} style={{ flex: 1, height: h, background: i === 26 ? theme.accent : theme.status.green.solid, opacity: i === 26 ? 1 : 0.6, borderRadius: 2 }}/>;
              })}
            </div>
          </Card>
        </div>

        <div style={{ padding: '0 16px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Card theme={theme} padding={12}>
            <div style={{ fontSize: 11, color: theme.textDim, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{t.revenue}</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 2, letterSpacing: -0.3 }}>{fmtUZS(142800000)}</div>
          </Card>
          <Card theme={theme} padding={12}>
            <div style={{ fontSize: 11, color: theme.textDim, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{t.purchases}</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 2, letterSpacing: -0.3 }}>34</div>
          </Card>
          <Card theme={theme} padding={12}>
            <div style={{ fontSize: 11, color: theme.textDim, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{t.sales}</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 2, letterSpacing: -0.3 }}>27</div>
          </Card>
          <Card theme={theme} padding={12}>
            <div style={{ fontSize: 11, color: theme.textDim, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{t.returns}</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 2, letterSpacing: -0.3, color: theme.status.red.text }}>2</div>
          </Card>
        </div>

        <SectionTitle theme={theme}>{t.topModels}</SectionTitle>
        <div style={{ padding: '0 16px 14px' }}>
          <Card theme={theme} padding={0}>
            {tops.map((it, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i<tops.length-1?`1px solid ${theme.border}`:'none' }}>
                <div style={{ width: 22, fontSize: 13, fontWeight: 700, color: theme.textDim, fontVariantNumeric: 'tabular-nums' }}>{i+1}</div>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: theme.bg2, color: theme.textDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DeviceIcon category={it.cat} size={18}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{it.n}</div>
                  <div style={{ fontSize: 11, color: theme.textDim, marginTop: 1 }}>{it.sold} {lang==='uz'?'sotildi':'продано'}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: theme.status.green.text, fontVariantNumeric: 'tabular-nums' }}>+{fmtUZS(it.profit).replace('\u00A0сум','').replace('\u00A0so\'m','')}</div>
              </div>
            ))}
          </Card>
        </div>

        <div style={{ padding: '0 16px 14px' }}>
          <Card theme={theme} padding={14} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 20, background: theme.status.yellow.bg, color: theme.status.yellow.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconClock size={22}/></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: theme.textDim }}>{t.avg}</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>9.4 <span style={{ fontSize: 13, fontWeight: 500, color: theme.textDim }}>{t.days}</span></div>
            </div>
          </Card>
        </div>

        <div style={{ padding: '0 16px 16px' }}>
          <Button theme={theme} variant="outline" full>{t.export}</Button>
        </div>
      </div>
      <BottomNav theme={theme} active="reports" isAdmin={isAdmin} lang={lang}/>
    </Screen>
  );
}

// =========================================================
// 10. SEARCH (global)
// =========================================================
function ScreenSearch({ theme, lang, isAdmin }) {
  const t = lang === 'uz' ? {
    title: 'Qidiruv',
    placeholder: 'IMEI, model, ism...',
    devices: 'Qurilmalar', purchases: 'Sotib olishlar', sales: 'Sotuvlar', contacts: 'Kontragentlar',
    showMore: "Ko'proq ko'rsatish",
    in_stock: 'vitrinada', sold: 'sotildi',
  } : {
    title: 'Поиск',
    placeholder: 'IMEI, модель, имя...',
    devices: 'Устройства', purchases: 'Закупки', sales: 'Продажи', contacts: 'Контрагенты',
    showMore: 'Показать ещё',
    in_stock: 'в наличии', sold: 'продан',
  };
  return (
    <Screen theme={theme}>
      <div style={{ padding: '52px 16px 12px', background: theme.bg, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={iconBtn(theme)}><IconArrowL size={22}/></button>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 10,
          background: theme.bg2, borderRadius: 14, padding: '0 14px', height: 44,
          border: `1px solid ${theme.border}`,
        }}>
          <IconSearch size={18} stroke={theme.textDim}/>
          <span style={{ flex: 1, color: theme.text, fontSize: 15, fontWeight: 500 }}>Samsung A55</span>
          <IconX size={18} stroke={theme.textDim}/>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '6px 0 16px' }}>

        <SectionTitle theme={theme} right={<a style={{ fontSize: 12, color: theme.accent, fontWeight: 600 }}>{t.showMore}</a>}>{t.devices} · 4</SectionTitle>
        <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { d: 'Galaxy A55 5G 256GB', sub: 'IMEI 356218115473921', tag: t.in_stock, tone: 'green' },
            { d: 'Galaxy A55 5G 128GB', sub: 'IMEI 356218115482456', tag: t.sold, tone: 'blue' },
            { d: 'Galaxy A55 8/256GB', sub: 'IMEI 356218115488237', tag: t.in_stock, tone: 'green' },
          ].map((it, i) => (
            <Card key={i} theme={theme} padding={10} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: theme.bg2, color: theme.textDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconPhone size={18}/></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{it.d}</div>
                <div style={{ fontSize: 11, color: theme.textDim, fontFamily: window.MALIKA.mono, marginTop: 1 }}>{it.sub}</div>
              </div>
              <StatusBadge theme={theme} kind={it.tone} size="sm">{it.tag}</StatusBadge>
            </Card>
          ))}
        </div>

        <SectionTitle theme={theme}>{t.contacts} · 2</SectionTitle>
        <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { n: 'Алишер Турсунов', ph: '+998 90 555 11 22', role: lang==='uz'?'Sotuvchi':'Продавец', i: 'АТ', c: '#10B981' },
            { n: 'Алишер Каюмов', ph: '+998 91 333 44 55', role: lang==='uz'?'Xaridor':'Покупатель', i: 'АК', c: '#3B82F6' },
          ].map((it, i) => (
            <Card key={i} theme={theme} padding={10} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar initials={it.i} color={it.c} size={34}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{it.n}</div>
                <div style={{ fontSize: 11, color: theme.textDim, fontFamily: window.MALIKA.mono }}>{it.ph}</div>
              </div>
              <span style={{ fontSize: 11, color: theme.textDim }}>{it.role}</span>
            </Card>
          ))}
        </div>

        <SectionTitle theme={theme} right={<a style={{ fontSize: 12, color: theme.accent, fontWeight: 600 }}>{t.showMore}</a>}>{t.sales} · 6</SectionTitle>
        <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { d: 'Galaxy A55', who: 'Бахром Юсупов', date: '11.04', amt: 6000000 },
            { d: 'Galaxy A55', who: 'Жасур Каримов', date: '08.04', amt: 5800000 },
          ].map((it, i) => (
            <Card key={i} theme={theme} padding={10}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{it.d} → {it.who}</div>
                <div style={{ fontSize: 11, color: theme.textDim, fontFamily: window.MALIKA.mono }}>{it.date}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: theme.status.blue.text, marginTop: 2 }}>{fmtUZS(it.amt)}</div>
            </Card>
          ))}
        </div>
      </div>
    </Screen>
  );
}

// =========================================================
// 11. SCANNER
// =========================================================
function ScreenScanner({ theme, lang, isAdmin }) {
  const t = lang === 'uz' ? {
    align: "QR yoki shtrix kodni ramkaga joylashtiring",
    flash: "Chiroq", gallery: 'Galereya', manual: "Qo'lda kiritish",
  } : {
    align: 'Наведите QR или штрих-код на рамку',
    flash: 'Вспышка', gallery: 'Галерея', manual: 'Ввести вручную',
  };
  return (
    <Screen theme={theme}>
      <div style={{ flex: 1, position: 'relative', background: '#000', color: '#fff', overflow: 'hidden' }}>
        {/* fake camera background */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 30% 40%, #2a2c30 0%, #0d0f12 70%)',
        }}>
          {/* market stall hint */}
          <div style={{ position: 'absolute', top: '20%', left: '8%', width: 80, height: 100, borderRadius: 8, background: 'rgba(255,255,255,0.04)', filter: 'blur(2px)' }}/>
          <div style={{ position: 'absolute', bottom: '25%', right: '10%', width: 120, height: 80, borderRadius: 8, background: 'rgba(255,255,255,0.05)', filter: 'blur(3px)' }}/>
        </div>

        <div style={{ position: 'absolute', top: 54, left: 14, right: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button style={{ width: 44, height: 44, borderRadius: 22, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><IconX size={22}/></button>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 600 }}>{lang==='uz'?'Skaner':'Сканер'}</div>
          <button style={{ width: 44, height: 44, borderRadius: 22, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><IconBell size={20}/></button>
        </div>

        {/* viewfinder */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 240, height: 240 }}>
          <div style={{ position: 'absolute', inset: 0, boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)', borderRadius: 24 }}/>
          {/* corners */}
          {[
            { top: 0, left: 0, br: '24px 0 0 0', borders: { borderTop: `3px solid ${theme.accent}`, borderLeft: `3px solid ${theme.accent}` } },
            { top: 0, right: 0, br: '0 24px 0 0', borders: { borderTop: `3px solid ${theme.accent}`, borderRight: `3px solid ${theme.accent}` } },
            { bottom: 0, left: 0, br: '0 0 0 24px', borders: { borderBottom: `3px solid ${theme.accent}`, borderLeft: `3px solid ${theme.accent}` } },
            { bottom: 0, right: 0, br: '0 0 24px 0', borders: { borderBottom: `3px solid ${theme.accent}`, borderRight: `3px solid ${theme.accent}` } },
          ].map((c, i) => (
            <div key={i} style={{ position: 'absolute', ...c, width: 36, height: 36, borderRadius: c.br, ...c.borders }}/>
          ))}
          <div style={{ position: 'absolute', top: '50%', left: 8, right: 8, height: 2, background: theme.accent, boxShadow: `0 0 12px ${theme.accent}` }}/>
        </div>

        <div style={{ position: 'absolute', bottom: 140, left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.85)', padding: '0 40px' }}>
          {t.align}
        </div>

        <div style={{ position: 'absolute', bottom: 30, left: 0, right: 0, display: 'flex', justifyContent: 'space-around', padding: '0 16px' }}>
          {[
            { I: IconBell, l: t.flash },
            { I: IconCamera, l: t.gallery, big: true },
            { I: IconClipboard, l: t.manual },
          ].map((b, i) => (
            <button key={i} style={{
              width: b.big ? 64 : 52, height: b.big ? 64 : 52, borderRadius: '50%',
              border: 'none', background: b.big ? theme.accent : 'rgba(255,255,255,0.15)',
              color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              backdropFilter: 'blur(10px)',
            }}>
              <b.I size={b.big ? 28 : 22}/>
            </button>
          ))}
        </div>
      </div>
    </Screen>
  );
}

// =========================================================
// 12. SETTINGS
// =========================================================
function ScreenSettings({ theme, lang, isAdmin }) {
  const t = lang === 'uz' ? {
    title: 'Sozlamalar', profile: 'Profil', shop: "Do'kon", security: 'Xavfsizlik',
    notifs: 'Bildirishnomalar', subscription: 'Obuna', help: 'Yordam', logout: 'Chiqish',
    name: 'Ism', phone: 'Telefon', shopName: "Do'kon nomi", lang: 'Til',
    setLogin: "Login va parol o'rnatish", recoveryHint: 'Zaxira kirish',
    morning: 'Ertalabki yangiliklar', plan: 'Reja', validUntil: 'Amal qilish muddati',
    contact: 'Admin bilan bog\'lanish',
  } : {
    title: 'Настройки', profile: 'Профиль', shop: 'Магазин', security: 'Безопасность',
    notifs: 'Уведомления', subscription: 'Подписка', help: 'Помощь', logout: 'Выход',
    name: 'Имя', phone: 'Телефон', shopName: 'Название магазина', lang: 'Язык',
    setLogin: 'Установить логин и пароль', recoveryHint: 'Резервный вход',
    morning: 'Утренняя сводка', plan: 'План', validUntil: 'Действует до',
    contact: 'Связь с админом',
  };

  const Group = ({ title, children }) => (
    <>
      <SectionTitle theme={theme}>{title}</SectionTitle>
      <div style={{ padding: '0 16px 14px' }}>
        <Card theme={theme} padding={0}>{children}</Card>
      </div>
    </>
  );
  const Row = ({ icon, title, value, danger, last }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
      borderBottom: last ? 'none' : `1px solid ${theme.border}`,
      cursor: 'pointer',
    }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: danger ? theme.status.red.bg : theme.bg2, color: danger ? theme.status.red.text : theme.textDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div style={{ flex: 1, fontSize: 15, fontWeight: 500, color: danger ? theme.status.red.text : theme.text }}>{title}</div>
      {value && <span style={{ fontSize: 13, color: theme.textDim }}>{value}</span>}
      {!danger && <IconChevR size={16} stroke={theme.textDim}/>}
    </div>
  );

  return (
    <Screen theme={theme}>
      <TopBar theme={theme} title={t.title}/>
      <div style={{ flex: 1, overflow: 'auto', paddingTop: 6 }}>
        <div style={{ padding: '12px 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar initials="АТ" color="#10B981" size={56}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.3 }}>Алишер Турсунов</div>
            <div style={{ fontSize: 13, color: theme.textDim, fontFamily: window.MALIKA.mono, marginTop: 2 }}>+998 90 123 45 67</div>
            <div style={{ fontSize: 12, color: theme.accent, fontWeight: 600, marginTop: 2 }}>@alisher_t</div>
          </div>
          <button style={iconBtn(theme)}><IconChevR size={18}/></button>
        </div>

        <Group title={t.shop}>
          <Row icon={<IconStore size={18}/>} title={t.shopName} value="Malika Точка 14"/>
          <Row icon={<IconLang size={18}/>} title={t.lang} value={lang==='uz'?"O'zbekcha":'Русский'} last/>
        </Group>

        <Group title={t.security}>
          <Row icon={<IconKey size={18}/>} title={t.setLogin} value={t.recoveryHint}/>
          <Row icon={<IconShield size={18}/>} title={lang==='uz'?'Faol seansiyalar':'Активные сеансы'} value="2" last/>
        </Group>

        <Group title={t.notifs}>
          <Row icon={<IconBell size={18}/>} title={t.morning} value="08:30"/>
          <Row icon={<IconAlert size={18}/>} title={lang==='uz'?'Kechikkan to\'lovlar':'Просрочки'} value={lang==='uz'?'Yoqilgan':'Включены'} last/>
        </Group>

        <Group title={t.subscription}>
          <Row icon={<IconStar size={18}/>} title={t.plan} value="Pro"/>
          <Row icon={<IconCalendar size={18}/>} title={t.validUntil} value="15.10.2026" last/>
        </Group>

        <Group title={t.help}>
          <Row icon={<IconHelp size={18}/>} title={t.contact} value="@malika_admin"/>
          <Row icon={<IconLogOut size={18}/>} title={t.logout} danger last/>
        </Group>
        <div style={{ height: 8 }}/>
      </div>
      <BottomNav theme={theme} active="settings" isAdmin={isAdmin} lang={lang}/>
    </Screen>
  );
}

Object.assign(window, {
  ScreenNasiya, ScreenNasiyaCard, ScreenReports, ScreenSearch, ScreenScanner, ScreenSettings,
});
