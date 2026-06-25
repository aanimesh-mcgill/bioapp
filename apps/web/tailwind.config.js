/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    {
      pattern:
        /^(bg|text|border|ring|from|to|via)-heritage-(cream|paper|ink|muted|line|brown)(\/\d+)?$/,
    },
    'shadow-soft',
    'shadow-card',
    'min-h-touch',
    'min-w-touch',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f7f3eb',
          100: '#ede4d4',
          200: '#dcc9ad',
          300: '#c4a67a',
          400: '#a8845a',
          500: '#8b6b45',
          600: '#6b4e35',
          700: '#553d2a',
          800: '#3d2c1f',
          900: '#2c2419',
        },
        accent: {
          400: '#c4a67a',
          500: '#a8845a',
          600: '#8b6b45',
        },
        heritage: {
          cream: '#f7f3eb',
          paper: '#faf8f4',
          ink: '#2c2419',
          muted: '#8a7b6a',
          line: '#e8dfd0',
          brown: '#6b4e35',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
        hindi: ['Noto Sans Devanagari', 'Inter', 'system-ui', 'sans-serif'],
      },
      minHeight: {
        touch: '48px',
      },
      minWidth: {
        touch: '48px',
      },
      boxShadow: {
        soft: '0 2px 12px rgba(44, 36, 25, 0.06)',
        card: '0 1px 4px rgba(44, 36, 25, 0.08)',
      },
    },
  },
  plugins: [],
};
