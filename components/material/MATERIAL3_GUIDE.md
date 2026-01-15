/**
 * Material 3 Expressive Implementation Guide
 * 
 * This guide shows how to use Material Web components with the M3 Expressive design system.
 * 
 * Features:
 * - Material Design 3 tokens with pastel colors
 * - Expressive corner radius: 28px for large containers
 * - Emphasized easing for smooth, expressive motion
 * - Full integration with @material/material-color-utilities
 */

import { MaterialButton, MaterialCard, MaterialCheckbox, MaterialTextField } from '@/components/material';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Example 1: Using Material Web Components with 'use client'
 */
export function ExampleButtonComponent() {
  return (
    <>
      {/* Filled button with expressive styling */}
      <MaterialButton
        variant="filled"
        label="Filled Button"
      />

      {/* Outlined button */}
      <MaterialButton
        variant="outlined"
        label="Outlined Button"
      />

      {/* Text button */}
      <MaterialButton
        variant="text"
        label="Text Button"
      />

      {/* Elevated button (slightly lifted) */}
      <MaterialButton
        variant="elevated"
        label="Elevated Button"
      />

      {/* Tonal button (secondary emphasis) */}
      <MaterialButton
        variant="tonal"
        label="Tonal Button"
      />
    </>
  );
}

/**
 * Example 2: Material Cards with Expressive Shape
 */
export function ExampleCardComponent() {
  return (
    <MaterialCard variant="elevated">
      <div style={{ padding: '16px' }}>
        <h2 style={{ margin: '0 0 8px 0' }}>Card Title</h2>
        <p>
          This card uses the Material 3 Expressive corner radius (28px for large containers).
        </p>
      </div>
    </MaterialCard>
  );
}

/**
 * Example 3: Using the Theme Context
 */
export function ExampleThemeComponent() {
  const { isDark, setIsDark, sourceColor, setSourceColor } = useTheme();

  return (
    <div>
      <p>Current theme: {isDark ? 'Dark' : 'Light'}</p>
      <p>Source color: {sourceColor}</p>
      
      <MaterialButton
        variant="filled"
        label={isDark ? 'Switch to Light' : 'Switch to Dark'}
        onClick={() => setIsDark(!isDark)}
      />

      <MaterialButton
        variant="outlined"
        label="Change Source Color"
        onClick={() => setSourceColor('#FF6B6B')}
      />
    </div>
  );
}

/**
 * Example 4: Form Elements
 */
export function ExampleFormComponent() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <MaterialTextField
        variant="filled"
        label="Email Address"
        type="email"
        placeholder="you@example.com"
      />

      <MaterialTextField
        variant="outlined"
        label="Password"
        type="password"
        supportingText="At least 8 characters"
      />

      <MaterialCheckbox label="I agree to the terms" />
    </div>
  );
}

/**
 * CSS Variables Available
 * 
 * Shape (corner radius):
 * - --md-sys-shape-corner-extra-large: 28px (Expressive emphasis)
 * - --md-sys-shape-corner-large: 24px
 * - --md-sys-shape-corner-medium: 16px
 * - --md-sys-shape-corner-small: 8px
 * 
 * Motion Easing:
 * - --md-sys-motion-easing-emphasized: cubic-bezier(0.2, 0, 0, 1)
 * - --md-sys-motion-easing-emphasized-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1)
 * - --md-sys-motion-easing-emphasized-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15)
 * 
 * Motion Duration (short to extra-long):
 * - --md-sys-motion-duration-short1: 50ms
 * - --md-sys-motion-duration-short2: 100ms
 * - --md-sys-motion-duration-short3: 150ms
 * - --md-sys-motion-duration-short4: 200ms
 * - --md-sys-motion-duration-medium1: 250ms
 * - --md-sys-motion-duration-medium2: 300ms
 * - --md-sys-motion-duration-medium3: 350ms
 * - --md-sys-motion-duration-medium4: 400ms
 * - --md-sys-motion-duration-long1: 450ms
 * - --md-sys-motion-duration-long2: 500ms
 * - --md-sys-motion-duration-long3: 550ms
 * - --md-sys-motion-duration-long4: 600ms
 * - --md-sys-motion-duration-extra-long1: 700ms
 * - --md-sys-motion-duration-extra-long2: 800ms
 * - --md-sys-motion-duration-extra-long3: 900ms
 * - --md-sys-motion-duration-extra-long4: 1000ms
 * 
 * Color System (applied automatically):
 * - --md-sys-color-primary
 * - --md-sys-color-on-primary
 * - --md-sys-color-primary-container
 * - --md-sys-color-on-primary-container
 * - --md-sys-color-secondary
 * - --md-sys-color-on-secondary
 * - --md-sys-color-tertiary
 * - --md-sys-color-on-tertiary
 * - --md-sys-color-surface
 * - --md-sys-color-on-surface
 * - And many more...
 */

/**
 * Implementation Steps:
 * 
 * 1. Wrap your app with Material3Provider in app/layout.tsx:
 *    <Material3Provider>
 *      {children}
 *    </Material3Provider>
 * 
 * 2. Use Material Web components:
 *    - MaterialButton for all button types
 *    - MaterialCard for card containers
 *    - MaterialCheckbox for checkboxes
 *    - MaterialTextField for input fields
 *    - MaterialDialog for dialogs
 * 
 * 3. Use the useTheme hook to access/control the theme:
 *    const { isDark, setIsDark, sourceColor, setSourceColor } = useTheme();
 * 
 * 4. All components automatically use:
 *    - 28px corner radius for large containers (Expressive)
 *    - Emphasized easing for smooth motion
 *    - Material 3 color tokens
 * 
 * 5. Remember 'use client' directive is required for Material Web components
 */

export default function Material3Guide() {
  return (
    <div style={{ padding: '24px' }}>
      <h1>Material 3 Expressive Components</h1>
      <ExampleButtonComponent />
      <ExampleCardComponent />
      <ExampleThemeComponent />
      <ExampleFormComponent />
    </div>
  );
}
