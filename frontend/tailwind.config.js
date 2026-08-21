/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
        serif: ["IBM Plex Serif", "Georgia", "serif"],
      },
      colors: {
        ink: "#161616",
        paper: "#fbfaf8",
      },
    },
  },
  plugins: [],
};
