/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f5fa',
          100: '#dce8f3',
          200: '#b8d1e7',
          300: '#8ab4d6',
          400: '#5a93c0',
          500: '#3d78a8',
          600: '#1e3a5f',
          700: '#1a3252',
          800: '#162a45',
          900: '#122238',
        },
        accent: {
          400: '#f59e0b',
          500: '#d97706',
          600: '#b45309',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        hindi: ['Noto Sans Devanagari', 'Inter', 'system-ui', 'sans-serif'],
      },
      minHeight: {
        touch: '48px',
      },
      minWidth: {
        touch: '48px',
      },
    },
  },
  plugins: [],
};
