/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:     '#17191C',
        bg2:    '#1F2226',
        bg3:    '#272A2F',
        border: '#2D3036',
        'border-strong': '#3A3E45',
        text:      '#F2F4F7',
        'text-dim':   '#9AA0A8',
        'text-muted': '#6A6F77',
        accent: '#2AABEE',
        'accent-hover': '#1E96D2',
        'accent-faded': '#0E2A3A',
        danger:  '#F26E5E',
        success: '#3DDC97',
        warning: '#F2C552',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI"', 'Roboto', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-up': 'fadeUp 220ms ease-out both',
        'scale-in': 'scaleIn 280ms cubic-bezier(0.34,1.56,0.64,1) both',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        shimmer: 'shimmer 1.4s linear infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.88)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        pulseDot: {
          '0%,100%': { opacity: '1' },
          '50%':     { opacity: '0.3' },
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to:   { backgroundPosition: '-200% 0' },
        },
      },
    },
  },
  plugins: [],
};
