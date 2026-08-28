import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1d1d1f',
        'ink-muted': '#6e6e73',
        canvas: '#f5f5f7',
        accent: {
          DEFAULT: '#0071e3',
          light: '#e8f1fd',
          dark: '#0058b0',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04), 0 6px 16px rgba(0,0,0,0.05)',
        elevated: '0 2px 4px rgba(0,0,0,0.06), 0 12px 28px rgba(0,0,0,0.09)',
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      letterSpacing: {
        tight: '-0.02em',
        tighter: '-0.035em',
      },
    },
  },
  plugins: [],
} satisfies Config;
