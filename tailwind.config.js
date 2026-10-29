export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: 'rgb(var(--ink-900) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
          500: 'rgb(var(--ink-500) / <alpha-value>)',
        },
        brand: {
          200: '#d3c7ff',
          300: '#bba8fa',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: '#5634b8',
          900: '#34215d',
        },
        slate: {
          100: 'rgb(var(--text-100) / <alpha-value>)',
          200: 'rgb(var(--text-200) / <alpha-value>)',
          300: 'rgb(var(--text-300) / <alpha-value>)',
          400: 'rgb(var(--text-400) / <alpha-value>)',
          500: 'rgb(var(--text-500) / <alpha-value>)',
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
