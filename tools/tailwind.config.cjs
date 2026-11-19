/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    '../index.html',
    '../js/**/*.js'
  ],
  darkMode: ['selector', '[data-theme="m3-dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Google Sans', 'Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace']
      }
    }
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: ['light'],
    darkTheme: false,
    logs: false
  }
};
