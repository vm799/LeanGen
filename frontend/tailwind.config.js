/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,html}",
  ],
  theme: {
    extend: {
      colors: {
        'slate-950': '#0f172a',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
