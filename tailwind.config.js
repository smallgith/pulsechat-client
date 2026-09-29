export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#05080f',
          800: '#0b1120',
          700: '#111a2e',
          600: '#18243d',
          500: '#22304d',
        },
        brand: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: 0, transform: 'scale(.96)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
        bounceDot: {
          '0%, 80%, 100%': { transform: 'translateY(0)', opacity: 0.4 },
          '40%': { transform: 'translateY(-5px)', opacity: 1 },
        },
        shrink: {
          from: { width: '100%' },
          to: { width: '0%' },
        },
      },
      animation: {
        'fade-up': 'fade-up .25s ease-out',
        'pop-in': 'pop-in .18s ease-out',
        bounceDot: 'bounceDot 1.2s infinite',
      },
    },
  },
  plugins: [],
};