/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces — values come from CSS variables; switch by .dark on <html>
        bg: 'hsl(var(--bg) / <alpha-value>)',
        bg2: 'hsl(var(--bg2) / <alpha-value>)',
        bg3: 'hsl(var(--bg3) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        'border-strong': 'hsl(var(--border-strong) / <alpha-value>)',

        text: 'hsl(var(--text) / <alpha-value>)',
        'text-dim': 'hsl(var(--text-dim) / <alpha-value>)',
        'text-muted': 'hsl(var(--text-muted) / <alpha-value>)',

        accent: 'hsl(var(--accent) / <alpha-value>)',
        'accent-hover': 'hsl(var(--accent-hover) / <alpha-value>)',
        'accent-faded': 'hsl(var(--accent-faded) / <alpha-value>)',
        'accent-fg': 'hsl(var(--accent-fg) / <alpha-value>)',

        danger: 'hsl(var(--danger) / <alpha-value>)',
        'danger-faded': 'hsl(var(--danger-faded) / <alpha-value>)',
        success: 'hsl(var(--success) / <alpha-value>)',
        'success-faded': 'hsl(var(--success-faded) / <alpha-value>)',
        warning: 'hsl(var(--warning) / <alpha-value>)',
        'warning-faded': 'hsl(var(--warning-faded) / <alpha-value>)',
        info: 'hsl(var(--info) / <alpha-value>)',
      },
      fontFamily: {
        // System stack for first-paint + dense data tables (matches tenant).
        // Inter (Google-CDN) dropped — removes an external runtime dependency.
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI"', 'Roboto', 'system-ui', 'sans-serif'],
        // Self-hosted Geist for page titles + KPI numerals — same display face
        // as the tenant Mini App so platform + owner share one identity.
        display: ['"Geist Variable"', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Semantic scale replaces raw text-xs/sm/base/lg/xl
        micro: ['0.6875rem', { lineHeight: '0.875rem' }],          // 11px
        caption: ['0.75rem', { lineHeight: '1rem' }],              // 12px
        hint: ['0.8125rem', { lineHeight: '1.125rem' }],           // 13px
        label: ['0.875rem', { lineHeight: '1.25rem' }],            // 14px
        body: ['0.9375rem', { lineHeight: '1.375rem', letterSpacing: '-0.005em' }],
        'body-lg': ['1rem', { lineHeight: '1.5rem', letterSpacing: '-0.005em' }],
        subhead: ['1.125rem', { lineHeight: '1.5rem', letterSpacing: '-0.01em' }],
        'title-sm': ['1.25rem', { lineHeight: '1.625rem', letterSpacing: '-0.015em' }],
        title: ['1.5rem', { lineHeight: '1.875rem', letterSpacing: '-0.02em' }],
        display: ['2rem', { lineHeight: '2.375rem', letterSpacing: '-0.025em' }],
      },
      borderRadius: {
        card: '0.875rem',
      },
      animation: {
        'fade-up': 'fadeUp 220ms ease-out both',
        'fade-in': 'fadeIn 200ms ease-out both',
        'scale-in': 'scaleIn 220ms cubic-bezier(0.34,1.56,0.64,1) both',
        shimmer: 'shimmer 1.4s linear infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
