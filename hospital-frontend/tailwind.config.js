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
          50: '#f0f7ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0284c7', // Soft Medical Blue / Light Sky Blue
          600: '#0369a1', // Deep Medical Blue
          700: '#075985',
          800: '#0c4a6e',
          900: '#0f172a', // Slate
        },
        hospital: {
          blue: '#0284c7',   // Primary medical blue
          teal: '#0d9488',   // Accent medical teal
          gold: '#eab308',   // Soft amber for warnings
          red: '#ef4444',    // Soft red for emergency
          bg: '#f1f5f9',     // Very Light Blue / Off White
          text: '#1e293b',   // Slate gray for high readability text
          card: '#ffffff'    // Pure white for cards
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 1.5s infinite',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
