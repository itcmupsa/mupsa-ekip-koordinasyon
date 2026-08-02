/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#14201D', soft: '#5B6B66' },
        canvas: { DEFAULT: '#F7F8F7', surface: '#FFFFFF', border: '#E1E6E3' },
        brand: { DEFAULT: '#0F6B5C', dark: '#0B5347', soft: '#E4EFEC' },
        accent: { DEFAULT: '#C98A2C', soft: '#F6E9D3' },
        danger: { DEFAULT: '#B3261E', soft: '#F8E4E2' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(20, 32, 29, 0.06), 0 1px 12px rgba(20, 32, 29, 0.04)' },
    },
  },
  plugins: [],
}
