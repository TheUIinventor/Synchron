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
    // Apply the color theme to CSS variables immediately
    const colors = getThemeColors(theme)
    const root = document.documentElement
    applyThemeColors(colors, root)
  }

  // Reusable function to apply CSS variables for a theme to a given root element
  const applyThemeColors = (colors: ReturnType<typeof getThemeColors>, root: HTMLElement) => {
    const computedIsDark = root.classList.contains("dark")
    const primaryValue = computedIsDark ? colors.primary : adjustSaturation(colors.primary, 0.5)
    const secondaryValue = computedIsDark ? colors.secondary : adjustSaturation(colors.secondary, 0.6)
    const accentValue = computedIsDark ? colors.accent : adjustSaturation(colors.accent, 0.6)

    root.style.setProperty("--primary", primaryValue)
    root.style.setProperty("--primary-foreground", pickForeground(primaryValue))
    root.style.setProperty("--primary-container", colors.primaryDark)
    root.style.setProperty("--primary-container-foreground", pickForeground(colors.primaryDark))

    root.style.setProperty("--secondary", secondaryValue)
    root.style.setProperty("--secondary-foreground", pickForeground(secondaryValue))

    root.style.setProperty("--accent", accentValue)
    root.style.setProperty("--accent-foreground", pickForeground(accentValue))

    // Surfaces/cards/popovers
    const isDarkMode = computedIsDark
    if (!isDarkMode) {
      root.style.setProperty("--surface-container", clampLightness(adjustLightness(colors.primary, 96), 86))
      root.style.setProperty("--surface-container-high", clampLightness(adjustLightness(colors.primary, 92), 84))
      root.style.setProperty("--surface-container-highest", clampLightness(adjustLightness(colors.primary, 88), 82))
      root.style.setProperty("--surface-variant", clampLightness(adjustLightness(colors.primary, 98), 88))

      root.style.setProperty("--card", clampLightness(adjustLightness(colors.primary, 94), 86))
      root.style.setProperty("--card-foreground", pickForeground(clampLightness(adjustLightness(colors.primary, 94), 86)))

      root.style.setProperty("--popover", clampLightness(adjustLightness(colors.accent, 96), 86))
      root.style.setProperty("--popover-foreground", pickForeground(clampLightness(adjustLightness(colors.accent, 96), 86)))

      root.style.setProperty("--primary-gradient-start", clampLightness(adjustLightness(colors.primary, Math.min(98, parseLightness(colors.primary) + 6)), 72))
      root.style.setProperty("--primary-gradient-end", clampLightness(colors.primaryDark, 64))

      root.style.setProperty("--surface-gradient-start", clampLightness(adjustLightness(colors.primary, 98), 86))
      root.style.setProperty("--surface-gradient-end", clampLightness(adjustLightness(colors.accent, 92), 84))
      root.style.setProperty("--now-card", clampLightness(adjustLightness(colors.primary, 92), 86))
    } else {
      root.style.setProperty("--surface-container", adjustLightness(colors.primary, 14))
      root.style.setProperty("--surface-container-high", adjustLightness(colors.primary, 18))
      root.style.setProperty("--surface-container-highest", adjustLightness(colors.primary, 22))
      root.style.setProperty("--surface-variant", adjustLightness(colors.primary, 24))

      root.style.setProperty("--card", adjustLightness(colors.primary, 12))
      root.style.setProperty("--card-foreground", pickForeground(adjustLightness(colors.primary, 12)))

      root.style.setProperty("--popover", adjustLightness(colors.accent, 14))
      root.style.setProperty("--popover-foreground", pickForeground(adjustLightness(colors.accent, 14)))

      root.style.setProperty("--primary-gradient-start", adjustLightness(colors.primary, Math.max(8, parseLightness(colors.primary) - 6)))
      root.style.setProperty("--primary-gradient-end", colors.primaryDark)

      root.style.setProperty("--surface-gradient-start", adjustLightness(colors.primary, 22))
      root.style.setProperty("--surface-gradient-end", adjustLightness(colors.accent, 18))
      root.style.setProperty("--now-card", adjustLightness(colors.primary, 28))
    }
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
    applyThemeColors(colors, root)

    // Observe class changes on the document element (e.g., `dark` toggled) and re-apply theme variables.
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "class") {
          // Re-apply computed variables for the current color theme when `class` changes
          applyThemeColors(getThemeColors(colorTheme), document.documentElement)
        }
      }
    })
    obs.observe(document.documentElement, { attributes: true })
    return () => obs.disconnect()
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
  // OS-specific font stack for default theme:
  // - Windows: Segoe UI Variable (or Segoe UI fallback)
  // - macOS/iOS/iPadOS: SF Pro (system-ui resolves to this on Apple platforms)
  // - Android: Roboto
  // The browser will use the first available font in the stack
  const fontMap = {
    default: '"Segoe UI Variable", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "SF Pro", "Roboto", "Helvetica Neue", Arial, sans-serif',
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

// Parse the lightness percentage from an HSL triplet string like "217 91% 60%"
function parseLightness(hsl: string): number {
  try {
    const parts = hsl.trim().split(/\s+/)
    const last = parts[parts.length - 1]
    const match = /([0-9]+)\%/.exec(last)
    return match ? parseInt(match[1], 10) : 50
  } catch (e) {
    return 50
  }
}

// Return the same H and S with a new lightness value (0-100)
function adjustLightness(hsl: string, targetLightness: number): string {
  try {
    const parts = hsl.trim().split(/\s+/)
    if (parts.length < 3) return hsl
    const h = parts[0]
    const s = parts[1]
    const l = Math.max(0, Math.min(100, Math.round(targetLightness))) + "%"
    return `${h} ${s} ${l}`
  } catch (e) {
    return hsl
  }
}

// Ensure the returned HSL has at least `min` lightness
function clampLightness(hsl: string, minLightness: number): string {
  try {
    const parts = hsl.trim().split(/\s+/)
    if (parts.length < 3) return hsl
    const h = parts[0]
    const s = parts[1]
    const match = /([0-9]+)\%/.exec(parts[2])
    const l = match ? parseInt(match[1], 10) : 50
    const newL = Math.max(minLightness, l)
    return `${h} ${s} ${newL}%`
  } catch (e) {
    return hsl
  }
}

// Reduce the saturation of an HSL triplet by a factor (0-1).
function adjustSaturation(hsl: string, factor: number): string {
  try {
    const parts = hsl.trim().split(/\s+/)
    if (parts.length < 3) return hsl
    const h = parts[0]
    const s = parts[1]
    const l = parts[2]
    const match = /([0-9]+)\%/.exec(s)
    const sat = match ? parseInt(match[1], 10) : 100
    const newSat = Math.max(0, Math.min(100, Math.round(sat * Math.max(0, Math.min(1, factor)))))
    return `${h} ${newSat}% ${l}`
  } catch (e) {
    return hsl
  }
}
