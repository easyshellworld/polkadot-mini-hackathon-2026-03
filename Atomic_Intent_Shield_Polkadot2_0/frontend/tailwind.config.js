/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f0ff',
          100: '#e0e0ff',
          200: '#c7c7fe',
          300: '#a3a3fc',
          400: '#7c7cf8',
          500: '#5c5cf2',
          600: '#4a3de6',
          700: '#3e2fcb',
          800: '#3428a4',
          900: '#2d2682',
          950: '#1c174e',
        },
        dark: {
          50: '#f6f6f7',
          100: '#e2e3e5',
          200: '#c4c5ca',
          300: '#9fa1a8',
          400: '#7b7d86',
          500: '#61636c',
          600: '#4d4e56',
          700: '#3f4046',
          800: '#35363a',
          900: '#1e1f22',
          950: '#121316',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
