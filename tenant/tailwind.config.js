/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // ── Typography scale ───────────────────────────────────────────────────
    // Named tokens instead of arbitrary px. Change one number → updates everywhere.
    fontSize: {
      'micro':    ['10px', { lineHeight: '14px', letterSpacing: '0.02em' }],
      'caption':  ['11px', { lineHeight: '15px' }],
      'hint':     ['12px', { lineHeight: '16px' }],
      'label':    ['13px', { lineHeight: '18px' }],
      'body':     ['14px', { lineHeight: '20px' }],
      'body-lg':  ['15px', { lineHeight: '22px' }],
      'body-xl':  ['16px', { lineHeight: '24px' }],
      'subhead':  ['17px', { lineHeight: '24px' }],
      'title-sm': ['20px', { lineHeight: '28px' }],
      'title':    ['24px', { lineHeight: '32px' }],
      'title-lg': ['28px', { lineHeight: '36px' }],
      'display':  ['34px', { lineHeight: '40px' }],
      'xs':   ['12px', { lineHeight: '16px' }],
      'sm':   ['14px', { lineHeight: '20px' }],
      'base': ['16px', { lineHeight: '24px' }],
      'lg':   ['18px', { lineHeight: '28px' }],
      'xl':   ['20px', { lineHeight: '28px' }],
      '2xl':  ['24px', { lineHeight: '32px' }],
      '3xl':  ['30px', { lineHeight: '36px' }],
      '4xl':  ['36px', { lineHeight: '40px' }],
    },

    container: {
      center: true,
      padding: '1rem',
      screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1200px' },
    },

    extend: {
      // ── Semantic colors ────────────────────────────────────────────────────
      // `R G B` (space-separated) so `bg-accent/50` works via opacity modifier.
      colors: {
        // Our token names (semantic, used pervasively in code)
        bg:               'rgb(var(--c-bg)              / <alpha-value>)',
        bg2:              'rgb(var(--c-bg2)             / <alpha-value>)',
        bg3:              'rgb(var(--c-bg3)             / <alpha-value>)',
        border:           'rgb(var(--c-border)          / <alpha-value>)',
        'border-strong':  'rgb(var(--c-border-strong)   / <alpha-value>)',
        text:             'rgb(var(--c-text)            / <alpha-value>)',
        'text-dim':       'rgb(var(--c-text-dim)        / <alpha-value>)',
        'text-muted':     'rgb(var(--c-text-muted)      / <alpha-value>)',
        accent:           'rgb(var(--c-accent)          / <alpha-value>)',
        'accent-hover':   'rgb(var(--c-accent-hover)    / <alpha-value>)',
        'accent-faded':   'rgb(var(--c-accent-faded)    / <alpha-value>)',
        danger:           'rgb(var(--c-danger)          / <alpha-value>)',
        'danger-faded':   'rgb(var(--c-danger-faded)    / <alpha-value>)',
        success:          'rgb(var(--c-success)         / <alpha-value>)',
        'success-faded':  'rgb(var(--c-success-faded)   / <alpha-value>)',
        warning:          'rgb(var(--c-warning)         / <alpha-value>)',
        'warning-faded':  'rgb(var(--c-warning-faded)   / <alpha-value>)',
        profit:           'rgb(var(--c-success)         / <alpha-value>)',
        frozen:           'rgb(var(--c-warning)         / <alpha-value>)',

        // shadcn-compatible aliases mapped onto our tokens so generated
        // components style themselves consistently with the rest of the app.
        background:       'rgb(var(--c-bg)              / <alpha-value>)',
        foreground:       'rgb(var(--c-text)            / <alpha-value>)',
        card: {
          DEFAULT:        'rgb(var(--c-bg2)             / <alpha-value>)',
          foreground:     'rgb(var(--c-text)            / <alpha-value>)',
        },
        popover: {
          DEFAULT:        'rgb(var(--c-bg3)             / <alpha-value>)',
          foreground:     'rgb(var(--c-text)            / <alpha-value>)',
        },
        primary: {
          DEFAULT:        'rgb(var(--c-accent)          / <alpha-value>)',
          foreground:     'rgb(var(--c-on-accent)       / <alpha-value>)',
        },
        secondary: {
          DEFAULT:        'rgb(var(--c-bg3)             / <alpha-value>)',
          foreground:     'rgb(var(--c-text)            / <alpha-value>)',
        },
        muted: {
          DEFAULT:        'rgb(var(--c-bg2)             / <alpha-value>)',
          foreground:     'rgb(var(--c-text-dim)        / <alpha-value>)',
        },
        destructive: {
          DEFAULT:        'rgb(var(--c-danger)          / <alpha-value>)',
          foreground:     'rgb(255 255 255              / <alpha-value>)',
        },
        input:            'rgb(var(--c-border)          / <alpha-value>)',
        ring:             'rgb(var(--c-accent)          / <alpha-value>)',
        chart: {
          1:              'rgb(var(--c-accent)          / <alpha-value>)',
          2:              'rgb(var(--c-success)         / <alpha-value>)',
          3:              'rgb(var(--c-warning)         / <alpha-value>)',
          4:              'rgb(var(--c-danger)          / <alpha-value>)',
          5:              'rgb(var(--c-text-dim)        / <alpha-value>)',
        },
      },

      // ── Radius / heights ───────────────────────────────────────────────────
      borderRadius: {
        card:    '16px',
        input:   '12px',
        chip:    '8px',
        badge:   '9999px',
        // shadcn-compatible (used by generated components)
        lg:      'var(--radius)',
        md:      'calc(var(--radius) - 2px)',
        sm:      'calc(var(--radius) - 4px)',
      },
      height: {
        input:    '48px',
        'input-sm': '36px',
        'input-lg': '56px',
        nav:      '64px',
      },

      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI"', 'Roboto', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },

      keyframes: {
        // app
        fadeUp:       { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeIn:       { from: { opacity: '0' }, to: { opacity: '1' } },
        scaleIn:      { from: { opacity: '0', transform: 'scale(0.92)' }, to: { opacity: '1', transform: 'scale(1)' } },
        slideInRight: { from: { opacity: '0', transform: 'translateX(20px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        pulseDot:     { '0%,100%': { opacity: '1', transform: 'scale(1)' }, '50%': { opacity: '0.4', transform: 'scale(0.85)' } },
        shimmer:      { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
        // radix accordion (required by tailwindcss-animate consumers)
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up':   { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'fade-up':        'fadeUp 260ms cubic-bezier(0.22,1,0.36,1) both',
        'fade-in':        'fadeIn 200ms ease-out both',
        'scale-in':       'scaleIn 320ms cubic-bezier(0.34,1.56,0.64,1) both',
        'slide-in-right': 'slideInRight 240ms cubic-bezier(0.22,1,0.36,1) both',
        'pulse-dot':      'pulseDot 2s ease-in-out infinite',
        shimmer:          'shimmer 1.6s linear infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
      },
      boxShadow: {
        'glow-accent':  '0 0 0 1px rgb(var(--c-accent)/0.3),  0 8px 32px -8px rgb(var(--c-accent)/0.4)',
        'glow-success': '0 0 0 1px rgb(var(--c-success)/0.25), 0 8px 32px -8px rgb(var(--c-success)/0.35)',
        'glow-danger':  '0 0 0 1px rgb(var(--c-danger)/0.25),  0 8px 32px -8px rgb(var(--c-danger)/0.35)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
