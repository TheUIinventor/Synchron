"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ThemeProviderProps } from "next-themes"
import type { PropsWithChildren } from 'react'

export type ColorTheme = "blue" | "purple" | "green" | "red" | "orange"
export type FontTheme = "default" | "minecraft" | "comic" | "impact" | "papyrus" | "courier" | "times"
export type NavItem =
  | "home"
  | "timetable"
  | "notices"
  | "clipboard"
  | "awards"
  | "calendar"
  | "bell-times"
  | "library"
  | "canteen"

export function ThemeProvider(props: PropsWithChildren<ThemeProviderProps>) {
  const { children, ...rest } = props
  return <NextThemesProvider {...(rest as ThemeProviderProps)}>{children}</NextThemesProvider>
}

// Create a context for user settings
type UserSettingsContextType = {
  navigationTabs: NavItem[]
  setNavigationTabs: (tabs: NavItem[]) => void
  colorTheme: ColorTheme
  setColorTheme: (theme: ColorTheme) => void
  fontTheme: FontTheme
  setFontTheme: (theme: FontTheme) => void
}

const UserSettingsContext = createContext<UserSettingsContextType | undefined>(undefined)

export function UserSettingsProvider({ children }: { children: React.ReactNode }) {
  const [navigationTabs, setNavigationTabsState] = useState<NavItem[]>([
    "home",
    "timetable",
    "notices",
    "clipboard",
    "awards",
  ])
  const [colorTheme, setColorThemeState] = useState<ColorTheme>("blue")
  const [fontTheme, setFontThemeState] = useState<FontTheme>("default")

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedTabs = localStorage.getItem("synchron-navigation-tabs")
    if (savedTabs) {
      try {
        const parsedTabs = JSON.parse(savedTabs)
        if (Array.isArray(parsedTabs)) {
          setNavigationTabsState(parsedTabs)
        }
      } catch (error) {
        // Use default tabs if parsing fails
      }
    }

    const savedColorTheme = localStorage.getItem("synchron-color-theme")
    if (savedColorTheme && ["blue", "purple", "green", "red", "orange"].includes(savedColorTheme)) {
      setColorThemeState(savedColorTheme as ColorTheme)
    }

    const savedFontTheme = localStorage.getItem("synchron-font-theme")
    if (
      savedFontTheme &&
      ["default", "minecraft", "comic", "impact", "papyrus", "courier", "times"].includes(savedFontTheme)
    ) {
      setFontThemeState(savedFontTheme as FontTheme)
    }
  }, [])

  // Save settings to localStorage when changed
  const setNavigationTabs = (tabs: NavItem[]) => {
    setNavigationTabsState(tabs)
    localStorage.setItem("synchron-navigation-tabs", JSON.stringify(tabs))
  }

  const setColorTheme = (theme: ColorTheme) => {
    setColorThemeState(theme)
    localStorage.setItem("synchron-color-theme", theme)

    // Apply the color theme to CSS variables
    const colors = getThemeColors(theme)
    const root = document.documentElement

    // Map to the CSS variables used by Tailwind config and components
    root.style.setProperty("--primary", colors.primary)
    // Choose a readable foreground based on lightness of the color
    root.style.setProperty("--primary-foreground", pickForeground(colors.primary))
    root.style.setProperty("--primary-container", colors.primaryDark)
    root.style.setProperty("--primary-container-foreground", pickForeground(colors.primaryDark))

    root.style.setProperty("--secondary", colors.secondary)
    root.style.setProperty("--secondary-foreground", pickForeground(colors.secondary))

    root.style.setProperty("--accent", colors.accent)
    root.style.setProperty("--accent-foreground", pickForeground(colors.accent))
  }

  const setFontTheme = (theme: FontTheme) => {
    setFontThemeState(theme)
    localStorage.setItem("synchron-font-theme", theme)

    // Apply the font theme to the body
    const fontFamily = getFontFamily(theme)
    document.body.style.fontFamily = fontFamily
  }

  // Apply initial color theme
  useEffect(() => {
    const colors = getThemeColors(colorTheme)
    const root = document.documentElement

    root.style.setProperty("--primary", colors.primary)
    root.style.setProperty("--primary-foreground", pickForeground(colors.primary))
    root.style.setProperty("--primary-container", colors.primaryDark)
    root.style.setProperty("--primary-container-foreground", pickForeground(colors.primaryDark))

    root.style.setProperty("--secondary", colors.secondary)
    root.style.setProperty("--secondary-foreground", pickForeground(colors.secondary))

    root.style.setProperty("--accent", colors.accent)
    root.style.setProperty("--accent-foreground", pickForeground(colors.accent))
  }, [colorTheme])

  // Apply initial font theme
  useEffect(() => {
    const fontFamily = getFontFamily(fontTheme)
    document.body.style.fontFamily = fontFamily
  }, [fontTheme])

  return (
    <UserSettingsContext.Provider
      value={{ navigationTabs, setNavigationTabs, colorTheme, setColorTheme, fontTheme, setFontTheme }}
    >
      {children}
    </UserSettingsContext.Provider>
  )
}

export function useUserSettings() {
  const context = useContext(UserSettingsContext)
  if (context === undefined) {
    throw new Error("useUserSettings must be used within a UserSettingsProvider")
  }
  return context
}

// Helper function to get theme color values
function getThemeColors(theme: ColorTheme) {
  const colorMap = {
    blue: {
      primary: "217 91% 60%",
      primaryDark: "217 91% 50%",
      secondary: "217 91% 95%",
      secondaryDark: "217 91% 15%",
      accent: "217 91% 85%",
      accentDark: "217 91% 25%",
    },
    purple: {
      primary: "262 83% 58%",
      primaryDark: "262 83% 48%",
      secondary: "262 83% 95%",
      secondaryDark: "262 83% 15%",
      accent: "262 83% 85%",
      accentDark: "262 83% 25%",
    },
    green: {
      primary: "142 76% 36%",
      primaryDark: "142 76% 26%",
      secondary: "142 76% 95%",
      secondaryDark: "142 76% 15%",
      accent: "142 76% 85%",
      accentDark: "142 76% 25%",
    },
    red: {
      primary: "0 84% 60%",
      primaryDark: "0 84% 50%",
      secondary: "0 84% 95%",
      secondaryDark: "0 84% 15%",
      accent: "0 84% 85%",
      accentDark: "0 84% 25%",
    },
    orange: {
      primary: "25 95% 53%",
      primaryDark: "25 95% 43%",
      secondary: "25 95% 95%",
      secondaryDark: "25 95% 15%",
      accent: "25 95% 85%",
      accentDark: "25 95% 25%",
    },
  }

  return colorMap[theme]
}

// Helper function to get font family
function getFontFamily(theme: FontTheme): string {
  const fontMap = {
    default: '"Calibri", "sans-serif"',
    minecraft: "var(--font-vt323)",
    comic: '"Comic Sans MS", "Comic Sans", cursive, sans-serif',
    impact: '"Impact", "Arial Black", sans-serif',
    papyrus: '"Papyrus", "Bradley Hand", cursive, sans-serif',
    courier: '"Courier New", "Courier", monospace',
    times: '"Times New Roman", "Times", serif',
  }

  return fontMap[theme]
}

// Pick a readable foreground HSL triplet based on the lightness of an HSL value
function pickForeground(hsl: string): string {
  try {
    const parts = hsl.trim().split(/\s+/)
    const last = parts[parts.length - 1]
    const match = /([0-9]+)\%/.exec(last)
    const lightness = match ? parseInt(match[1], 10) : 50
    // If background is light, use dark text; otherwise use light text
    return lightness > 60 ? "0 0% 9%" : "0 0% 98%"
  } catch (e) {
    return "0 0% 98%"
  }
}
