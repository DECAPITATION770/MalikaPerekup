/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // ── Typography scale ───────────────────────────────────────────────────
    // Named tokens instead of arbitrary px. Change one number → updates everywhere.
    fontSize: {
      'micro':    ['10px', { lineHeight: '14px', letterSpacing: '0.02em' }],
      'caption':  ['11px', { lineHeight: '15px' }],
      'hint':     ['12px', { lineHeight: '16px' }],
      'label':    ['13px', { lineHeight: '18px' }],   // labels, secondary text
      'body':     ['14px', { lineHeight: '20px' }],   // body text
      'body-lg':  ['15px', { lineHeight: '22px' }],
      'body-xl':  ['16px', { lineHeight: '24px' }],
      'subhead':  ['17px', { lineHeight: '24px' }],
      'title-sm': ['20px', { lineHeight: '28px' }],
      'title':    ['24px', { lineHeight: '32px' }],   // page titles
      'title-lg': ['28px', { lineHeight: '36px' }],
      'display':  ['34px', { lineHeight: '40px' }],   // KPI numbers
      // keep standard Tailwind aliases for compatibility with existing text-sm/xs etc.
      'xs':   ['12px', { lineHeight: '16px' }],
      'sm':   ['14px', { lineHeight: '20px' }],
      'base': ['16px', { lineHeight: '24px' }],
      'lg':   ['18px', { lineHeight: '28px' }],
      'xl':   ['20px', { lineHeight: '28px' }],
      '2xl':  ['24px', { lineHeight: '32px' }],
      '3xl':  ['30px', { lineHeight: '36px' }],
      '4xl':  ['36px', { lineHeight: '40px' }],
    },

    extend: {
      // ── Color tokens via CSS variables → runtime theming support ──────────
      // Format: 'R G B' (space-separated) so opacity modifiers work: bg-accent/50
      colors: {
        bg:            'rgb(var(--c-bg)     / <alpha-value>)',
        bg2:           'rgb(var(--c-bg2)    / <alpha-value>)',
        bg3:           'rgb(var(--c-bg3)    / <alpha-value>)',
        border:        'rgb(var(--c-border) / <alpha-value>)',
        'border-strong':'rgb(var(--c-border-strong) / <alpha-value>)',
        text:          'rgb(var(--c-text)      / <alpha-value>)',
        'text-dim':    'rgb(var(--c-text-dim)  / <alpha-value>)',
        'text-muted':  'rgb(var(--c-text-muted)/ <alpha-value>)',
        accent:        'rgb(var(--c-accent)    / <alpha-value>)',
        'accent-hover':'rgb(var(--c-accent-hover) / <alpha-value>)',
        'accent-faded':'rgb(var(--c-accent-faded) / <alpha-value>)',
        danger:        'rgb(var(--c-danger)        / <alpha-value>)',
        'danger-faded':'rgb(var(--c-danger-faded)  / <alpha-value>)',
        success:       'rgb(var(--c-success)        / <alpha-value>)',
        'success-faded':'rgb(var(--c-success-faded) / <alpha-value>)',
        warning:       'rgb(var(--c-warning)        / <alpha-value>)',
        'warning-faded':'rgb(var(--c-warning-faded) / <alpha-value>)',
        profit:        'rgb(var(--c-success) / <alpha-value>)',
        frozen:        'rgb(var(--c-warning) / <alpha-value>)',
      },

      // ── Border radius tokens ───────────────────────────────────────────────
      borderRadius: {
        'card':  '16px',   // cards, modals
        'input': '12px',   // inputs, buttons
        'chip':  '8px',    // small chips, tags
        'badge': '9999px', // pill badges
      },

      // ── Height tokens ──────────────────────────────────────────────────────
      height: {
        'input':    '48px',  // standard input / button (h-12)
        'input-sm': '36px',  // compact chip / small button (h-9)
        'input-lg': '56px',  // large input / big button (h-14)
        'nav':      '64px',  // bottom nav bar
      },

      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI"', 'Roboto', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      animation: {
        'fade-up':       'fadeUp 260ms cubic-bezier(0.22,1,0.36,1) both',
        'fade-in':       'fadeIn 200ms ease-out both',
        'scale-in':      'scaleIn 320ms cubic-bezier(0.34,1.56,0.64,1) both',
        'slide-in-right':'slideInRight 240ms cubic-bezier(0.22,1,0.36,1) both',
        'pulse-dot':     'pulseDot 2s ease-in-out infinite',
        shimmer:         'shimmer 1.6s linear infinite',
        'count-up':      'countUp 600ms cubic-bezier(0.22,1,0.36,1) both',
      },
      keyframes: {
        fadeUp:       { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeIn:       { from: { opacity: '0' }, to: { opacity: '1' } },
        scaleIn:      { from: { opacity: '0', transform: 'scale(0.92)' }, to: { opacity: '1', transform: 'scale(1)' } },
        slideInRight: { from: { opacity: '0', transform: 'translateX(20px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        pulseDot:     { '0%,100%': { opacity: '1', transform: 'scale(1)' }, '50%': { opacity: '0.4', transform: 'scale(0.85)' } },
        shimmer:      { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
        countUp:      { from: { opacity: '0', transform: 'translateY(8px) scale(0.96)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
      },
      boxShadow: {
        'glow-accent':  '0 0 0 1px rgb(var(--c-accent)/0.3), 0 8px 32px -8px rgb(var(--c-accent)/0.4)',
        'glow-success': '0 0 0 1px rgb(var(--c-success)/0.25), 0 8px 32px -8px rgb(var(--c-success)/0.35)',
        'glow-danger':  '0 0 0 1px rgb(var(--c-danger)/0.25), 0 8px 32px -8px rgb(var(--c-danger)/0.35)',
      },
    },
  },
  plugins: [],
};
