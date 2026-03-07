/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx,mdx}", "./components/**/*.{js,jsx,ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        medical: {
          50: "#eff6ff",
          100: "#dbeafe",
          600: "#0284c7",
          700: "#0369a1"
        }
      }
    }
  },
  plugins: []
};