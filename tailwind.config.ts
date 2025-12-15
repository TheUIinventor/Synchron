import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
	],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        // OS-specific font stack:
        // - Windows: Segoe UI Variable (modern) or Segoe UI
        // - macOS/iOS/iPadOS: SF Pro (via system-ui/-apple-system)
        // - Android: Roboto
        sans: ['"Segoe UI Variable"', '"Segoe UI"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"SF Pro"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        serif: ['Georgia', '"Times New Roman"', 'serif'],
      },
      colors: {
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        
        // Material 3 Roles
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          container: "hsl(var(--primary-container) / <alpha-value>)",
          "container-foreground": "hsl(var(--primary-container-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
          container: "hsl(var(--secondary-container) / <alpha-value>)",
          "container-foreground": "hsl(var(--secondary-container-foreground) / <alpha-value>)",
        },
        tertiary: {
            DEFAULT: "hsl(var(--tertiary) / <alpha-value>)",
            foreground: "hsl(var(--tertiary-foreground) / <alpha-value>)",
            container: "hsl(var(--tertiary-container) / <alpha-value>)",
            "container-foreground": "hsl(var(--tertiary-container-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        // M3 Surface Tones
        surface: {
            DEFAULT: "hsl(var(--background) / <alpha-value>)",
            container: "hsl(var(--surface-container) / <alpha-value>)",
            "container-high": "hsl(var(--surface-container-high) / <alpha-value>)",
            variant: "hsl(var(--surface-variant) / <alpha-value>)",
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Expressive Shapes
        "m3-xl": "28px",
        "m3-2xl": "40px", 
        "m3-flower": "48px", // Special shape
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      transitionTimingFunction: {
        // M3 Expressive Motion (Overshoot)
        'expressive': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', 
        'standard': 'cubic-bezier(0.2, 0.0, 0, 1.0)',
      },
      boxShadow: {
        'elevation-1': '0px 1px 2px rgba(0,0,0,0.3), 0px 1px 3px 1px rgba(0,0,0,0.15)',
        'elevation-2': '0px 1px 2px rgba(0,0,0,0.3), 0px 2px 6px 2px rgba(0,0,0,0.15)',
        'elevation-3': '0px 4px 8px 3px rgba(0,0,0,0.15), 0px 1px 3px rgba(0,0,0,0.3)',
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
