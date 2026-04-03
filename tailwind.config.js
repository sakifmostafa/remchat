/** @type {import('tailwindcss').Config} */
export default {
  content: ['src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        oxblood: {
          DEFAULT: '#722F37',
          primary: '#722F37',
          dark: '#5A252C',
          light: '#8B3A42',
          50: '#FAF0F2',
          100: '#F5E0E3',
          200: '#EBC1C6',
          300: '#D6A3A9',
          400: '#C1858C',
          500: '#A8676F',
          600: '#8B3A42',
          700: '#722F37',
          800: '#5A252C',
          900: '#4A1F25',
        },
        beige: {
          bg: '#F5F0E8',
          light: '#FAF7F2',
          DEFAULT: '#F5F0E8',
          dark: '#E8E0D0',
        },
        cream: '#FFFDF7',
        text: {
          primary: '#2D2422',
          secondary: '#6B5E57',
          muted: '#9B8E87',
        },
        semantic: {
          success: '#4A7C59',
          error: '#C44536',
          warning: '#D4A843',
          info: '#5B7FA5',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        soft: '0 2px 15px rgba(45, 36, 34, 0.08)',
        medium: '0 4px 20px rgba(45, 36, 34, 0.12)',
        large: '0 8px 30px rgba(45, 36, 34, 0.16)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      spacing: {
        18: '4.5rem',
        88: '22rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-in': 'slideIn 0.3s ease-out forwards',
        'typing': 'typing 1.4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
