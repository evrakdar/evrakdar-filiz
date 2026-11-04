import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        zinc: { 50: "#F7F6F1", 100: "#F1F0EA" },
        brand: {
          50: "rgb(var(--brand-50) / <alpha-value>)",
          100: "rgb(var(--brand-100) / <alpha-value>)",
          200: "rgb(var(--brand-200) / <alpha-value>)",
          300: "rgb(var(--brand-300) / <alpha-value>)",
          400: "rgb(var(--brand-400) / <alpha-value>)",
          500: "rgb(var(--brand-500) / <alpha-value>)",
          600: "rgb(var(--brand-600) / <alpha-value>)",
          700: "rgb(var(--brand-700) / <alpha-value>)",
          800: "rgb(var(--brand-800) / <alpha-value>)",
          900: "rgb(var(--brand-900) / <alpha-value>)",
          950: "rgb(var(--brand-950) / <alpha-value>)"
        },
        brand2: {
          50: "rgb(var(--brand2-50) / <alpha-value>)",
          100: "rgb(var(--brand2-100) / <alpha-value>)",
          200: "rgb(var(--brand2-200) / <alpha-value>)",
          300: "rgb(var(--brand2-300) / <alpha-value>)",
          400: "rgb(var(--brand2-400) / <alpha-value>)",
          500: "rgb(var(--brand2-500) / <alpha-value>)",
          600: "rgb(var(--brand2-600) / <alpha-value>)",
          700: "rgb(var(--brand2-700) / <alpha-value>)",
          800: "rgb(var(--brand2-800) / <alpha-value>)",
          900: "rgb(var(--brand2-900) / <alpha-value>)",
          950: "rgb(var(--brand2-950) / <alpha-value>)"
        },
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      }
    }
  },
  plugins: []
} satisfies Config;

export default config;

