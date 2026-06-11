/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // ── Typography scale ───────────────────────────────────────────────────
    // Semantic-only — was 17 names for ~12 sizes (DESIGN_AUDIT.md §Type scale).
    // Codemod in this branch swept `text-xs/sm/base/xl/2xl/lg` → equivalents,
    // and `text-3xl/4xl` were unused. Adding new sizes here is encouraged —
    // adding back numeric Tailwind defaults is not.
    fontSize: {
      micro: ['10px', { lineHeight: '14px', letterSpacing: '0.02em' }],
      caption: ['11px', { lineHeight: '15px' }],
      hint: ['12px', { lineHeight: '16px' }],
      label: ['13px', { lineHeight: '18px' }],
      body: ['14px', { lineHeight: '20px' }],
      'body-lg': ['15px', { lineHeight: '22px' }],
      'body-xl': ['16px', { lineHeight: '24px' }],
      subhead: ['17px', { lineHeight: '24px' }],
      'title-sm': ['20px', { lineHeight: '28px' }],
      title: ['24px', { lineHeight: '32px' }],
      'title-lg': ['28px', { lineHeight: '36px' }],
      display: ['34px', { lineHeight: '40px' }],
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
        bg: 'rgb(var(--c-bg)              / <alpha-value>)',
        bg2: 'rgb(var(--c-bg2)             / <alpha-value>)',
        bg3: 'rgb(var(--c-bg3)             / <alpha-value>)',
        border: 'rgb(var(--c-border)          / <alpha-value>)',
        'border-strong': 'rgb(var(--c-border-strong)   / <alpha-value>)',
        text: 'rgb(var(--c-text)            / <alpha-value>)',
        'text-dim': 'rgb(var(--c-text-dim)        / <alpha-value>)',
        'text-muted': 'rgb(var(--c-text-muted)      / <alpha-value>)',
        accent: 'rgb(var(--c-accent)          / <alpha-value>)',
        'accent-hover': 'rgb(var(--c-accent-hover)    / <alpha-value>)',
        'accent-faded': 'rgb(var(--c-accent-faded)    / <alpha-value>)',
        danger: 'rgb(var(--c-danger)          / <alpha-value>)',
        'danger-faded': 'rgb(var(--c-danger-faded)    / <alpha-value>)',
        success: 'rgb(var(--c-success)         / <alpha-value>)',
        'success-faded': 'rgb(var(--c-success-faded)   / <alpha-value>)',
        warning: 'rgb(var(--c-warning)         / <alpha-value>)',
        'warning-faded': 'rgb(var(--c-warning-faded)   / <alpha-value>)',
        profit: 'rgb(var(--c-success)         / <alpha-value>)',
        frozen: 'rgb(var(--c-warning)         / <alpha-value>)',

        // shadcn-compatible aliases mapped onto our tokens so generated
        // components style themselves consistently with the rest of the app.
        background: 'rgb(var(--c-bg)              / <alpha-value>)',
        foreground: 'rgb(var(--c-text)            / <alpha-value>)',
        card: {
          DEFAULT: 'rgb(var(--c-bg2)             / <alpha-value>)',
          foreground: 'rgb(var(--c-text)            / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'rgb(var(--c-bg3)             / <alpha-value>)',
          foreground: 'rgb(var(--c-text)            / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'rgb(var(--c-accent)          / <alpha-value>)',
          foreground: 'rgb(var(--c-on-accent)       / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--c-bg3)             / <alpha-value>)',
          foreground: 'rgb(var(--c-text)            / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'rgb(var(--c-bg2)             / <alpha-value>)',
          foreground: 'rgb(var(--c-text-dim)        / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'rgb(var(--c-danger)          / <alpha-value>)',
          foreground: 'rgb(255 255 255              / <alpha-value>)',
        },
        input: 'rgb(var(--c-border)          / <alpha-value>)',
        ring: 'rgb(var(--c-accent)          / <alpha-value>)',
        chart: {
          1: 'rgb(var(--c-accent)          / <alpha-value>)',
          2: 'rgb(var(--c-success)         / <alpha-value>)',
          3: 'rgb(var(--c-warning)         / <alpha-value>)',
          4: 'rgb(var(--c-danger)          / <alpha-value>)',
          5: 'rgb(var(--c-text-dim)        / <alpha-value>)',
        },
      },

      // ── Radius / heights ───────────────────────────────────────────────────
      borderRadius: {
        card: '16px',
        input: '12px',
        chip: '8px',
        badge: '9999px',
        // shadcn-compatible (used by generated components)
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      height: {
        input: '48px',
        'input-sm': '36px',
        'input-lg': '56px',
        nav: '64px',
      },

      fontFamily: {
        // Body text — system stack stays the default because no webfont beats
        // the user's native fallback for first paint, and most of the UI is
        // utilitarian dense text where Geist's character vs system is marginal.
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Segoe UI"',
          'Roboto',
          'system-ui',
          'sans-serif',
        ],
        // Display face — applied only to hero headlines (h1/h2) and KPI
        // numerals. One axis of hierarchy the system font can't provide:
        // tighter spacing, more confident weights, distinct identity for the
        // numbers that actually run the business. Variable woff2 = ~70 KB.
        display: [
          '"Geist Variable"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          'system-ui',
          'sans-serif',
        ],
        mono: ['"SF Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },

      keyframes: {
        // app
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.92)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        pulseDot: {
          '0%,100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(0.85)' },
        },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%,60%': { transform: 'translateX(-6px)' },
          '40%,80%': { transform: 'translateX(6px)' },
        },
        // radix accordion (required by tailwindcss-animate consumers)
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 260ms cubic-bezier(0.22,1,0.36,1) both',
        'fade-in': 'fadeIn 200ms ease-out both',
        'scale-in': 'scaleIn 320ms cubic-bezier(0.34,1.56,0.64,1) both',
        'slide-in-right': 'slideInRight 240ms cubic-bezier(0.22,1,0.36,1) both',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
        shake: 'shake 380ms cubic-bezier(0.36,0.07,0.19,0.97) both',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      boxShadow: {
        // Flat by request — no coloured halo/glow. Kept under the same names
        // so existing `shadow-glow-*` call sites stay valid; they now render a
        // subtle neutral elevation that reads as "raised", not "glowing".
        'glow-accent': '0 1px 2px 0 rgb(0 0 0 / 0.22)',
        'glow-success': '0 1px 2px 0 rgb(0 0 0 / 0.22)',
        'glow-danger': '0 1px 2px 0 rgb(0 0 0 / 0.22)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
