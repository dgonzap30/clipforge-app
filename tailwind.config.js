/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ClipForge brand colors
        forge: {
          50: '#fef3f2',
          100: '#fee4e2',
          200: '#ffcdc9',
          300: '#fda4a0',
          400: '#f97066',
          500: '#f04438', // Primary red/orange
          600: '#de3024',
          700: '#bb241a',
          800: '#9a2319',
          900: '#80241c',
          950: '#450f0a',
        },
        dark: {
          50: '#f6f6f7',
          100: '#e2e3e5',
          200: '#c4c5ca',
          300: '#9fa1a8',
          400: '#7b7d86',
          500: '#60626b',
          600: '#4c4d55',
          700: '#3f4046',
          800: '#35363a',
          900: '#1e1f23', // Main background
          950: '#121316', // Darker background
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
