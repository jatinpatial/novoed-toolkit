import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0A0B0D",
          900: "#121318",
          800: "#1A1C22",
          700: "#2A2D36",
          600: "#464954",
          500: "#6B6F7A",
          400: "#9CA0AB",
          300: "#C8CBD2",
          200: "#E4E6EB",
          100: "#F2F3F5",
          50:  "#F9FAFB",
        },
        brand: {
          50:  "#E6F7EF",
          100: "#D1F0DD",
          200: "#A8E2BF",
          300: "#6FCE96",
          400: "#3DBD73",
          500: "#29BA74",
          600: "#1F9E5F",
          700: "#1B7A4F",
          800: "#155E3D",
          900: "#0F4028",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,18,24,0.04), 0 1px 3px rgba(16,18,24,0.04)",
        elevated: "0 4px 24px rgba(16,18,24,0.06), 0 1px 3px rgba(16,18,24,0.04)",
        focus: "0 0 0 3px rgba(41,186,116,0.18)",
      },
      borderRadius: {
        xl: "0.875rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
