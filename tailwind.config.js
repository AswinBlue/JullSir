/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9ebff',
          200: '#bce0ff',
          300: '#8eccff',
          400: '#58afff',
          500: '#3182f6', // 토스 블루 스타일
          600: '#1b64e5',
          700: '#154ec5',
          800: '#17409f',
          900: '#19397e',
        },
      },
      keyframes: {
        pulseFast: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.03)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      },
      animation: {
        pulseFast: 'pulseFast 1.5s ease-in-out infinite',
        slideUp: 'slideUp 0.3s ease-out forwards',
      }
    },
  },
  plugins: [],
}
