/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1f0',
          100: '#ffe4e1',
          200: '#ffcdc9',
          300: '#ffa89e',
          400: '#ff7265',
          500: '#ff385c',
          600: '#ed1d47',
          700: '#c80e35',
          800: '#a60f31',
          900: '#8b1130',
        },
      },
    },
  },
  plugins: [],
};
