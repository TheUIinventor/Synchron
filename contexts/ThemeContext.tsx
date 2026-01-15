"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { argbFromHex, themeFromSourceColor, applyTheme } from "@material/material-color-utilities";

interface ThemeContextType {
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
  sourceColor: string;
  setSourceColor: (color: string) => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  setIsDark: () => {},
  sourceColor: '#6750A4',
  setSourceColor: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

interface ThemeProviderProps {
  children: React.ReactNode;
  sourceColor?: string;
  initialDark?: boolean;
}

export function ThemeProvider({ 
  children, 
  sourceColor: initialSourceColor = '#6750A4',
  initialDark = false 
}: ThemeProviderProps) {
  const [isDark, setIsDark] = useState(initialDark);
  const [sourceColor, setSourceColor] = useState(initialSourceColor);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check for saved preference
    const savedDark = localStorage.getItem('theme-dark');
    const savedColor = localStorage.getItem('theme-source-color');
    
    if (savedDark !== null) {
      setIsDark(JSON.parse(savedDark));
    }
    if (savedColor) {
      setSourceColor(savedColor);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    try {
      // Generate the theme from the source color
      const theme = themeFromSourceColor(argbFromHex(sourceColor));
      
      // Apply it to the document
      applyTheme(theme, { target: document.documentElement, dark: isDark });

      // Inject Material 3 Expressive design tokens
      const expressiveSheet = document.createElement("style");
      expressiveSheet.id = "m3-expressive-tokens";
      
      // Remove existing expressive sheet if present
      const existing = document.getElementById("m3-expressive-tokens");
      if (existing) existing.remove();

      expressiveSheet.innerHTML = `
        :root {
          /* Material 3 Expressive: Extra-large shapes use 28px corner radius */
          --md-sys-shape-corner-extra-large: 28px;
          --md-sys-shape-corner-large: 24px;
          --md-sys-shape-corner-medium: 16px;
          --md-sys-shape-corner-small: 8px;
          
          /* Emphasized easing for expressive motion - smooth with slight overshoot */
          --md-sys-motion-easing-emphasized: cubic-bezier(0.2, 0, 0, 1);
          --md-sys-motion-easing-emphasized-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1);
          --md-sys-motion-easing-emphasized-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15);
          
          /* Standard M3 easing */
          --md-sys-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);
          --md-sys-motion-easing-standard-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1);
          --md-sys-motion-easing-standard-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15);
          
          /* Motion duration */
          --md-sys-motion-duration-short1: 50ms;
          --md-sys-motion-duration-short2: 100ms;
          --md-sys-motion-duration-short3: 150ms;
          --md-sys-motion-duration-short4: 200ms;
          --md-sys-motion-duration-medium1: 250ms;
          --md-sys-motion-duration-medium2: 300ms;
          --md-sys-motion-duration-medium3: 350ms;
          --md-sys-motion-duration-medium4: 400ms;
          --md-sys-motion-duration-long1: 450ms;
          --md-sys-motion-duration-long2: 500ms;
          --md-sys-motion-duration-long3: 550ms;
          --md-sys-motion-duration-long4: 600ms;
          --md-sys-motion-duration-extra-long1: 700ms;
          --md-sys-motion-duration-extra-long2: 800ms;
          --md-sys-motion-duration-extra-long3: 900ms;
          --md-sys-motion-duration-extra-long4: 1000ms;
        }

        /* Apply M3 Expressive styling to Material Web components */
        md-filled-button,
        md-outlined-button,
        md-text-button,
        md-elevated-button,
        md-tonal-button,
        md-fab {
          border-radius: var(--md-sys-shape-corner-medium);
          transition: all var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-emphasized);
        }

        md-card,
        md-elevated-card,
        md-outlined-card {
          border-radius: var(--md-sys-shape-corner-large);
          transition: all var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized);
        }

        md-dialog {
          border-radius: var(--md-sys-shape-corner-extra-large);
        }

        /* Standard transitions for interactive elements */
        md-checkbox,
        md-radio,
        md-switch,
        md-text-field,
        md-filled-text-field,
        md-outlined-text-field {
          transition: all var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
        }

        body {
          background-color: var(--md-sys-color-surface);
          color: var(--md-sys-color-on-surface);
          transition: background-color var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-standard);
          font-family: Roboto, system-ui, -apple-system, sans-serif;
        }
      `;
      document.head.appendChild(expressiveSheet);

      // Save preferences
      localStorage.setItem('theme-dark', JSON.stringify(isDark));
      localStorage.setItem('theme-source-color', sourceColor);
    } catch (error) {
      console.error('Error applying Material 3 theme:', error);
    }
  }, [isDark, sourceColor, mounted]);

  const value: ThemeContextType = {
    isDark,
    setIsDark,
    sourceColor,
    setSourceColor,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
