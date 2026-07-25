/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50:'#eef6ff',100:'#d9eaff',200:'#bcdbff',300:'#8ec4ff',400:'#59a3ff',500:'#337fff',600:'#1b5ef5',700:'#1449e1',800:'#173cb6',900:'#19378f',950:'#142357' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
