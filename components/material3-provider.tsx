"use client";

import React, { useEffect } from 'react';
import { ThemeProvider as M3ThemeProvider } from '@/contexts/ThemeContext';

/**
 * Material 3 Expressive Setup for Next.js
 * 
 * This provides Material Web components with M3 Expressive styling:
 * - Extra-large corner radius: 28px
 * - Emphasized easing for motion
 * - Full Material Design 3 token system
 */

export function Material3Provider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize Material Web components
    // This ensures the Material Design Web Components library is loaded
    try {
      // Dynamically import Material Web base styles and components
      import('@material/web/all');
    } catch (e) {
      console.debug('Material Web initialization:', e);
    }
  }, []);

  return (
    <M3ThemeProvider sourceColor="#6750A4" initialDark={false}>
      {children}
    </M3ThemeProvider>
  );
}
