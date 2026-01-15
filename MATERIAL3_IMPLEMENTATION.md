# Material 3 Expressive Implementation

This guide explains how to fully integrate Material 3 Expressive design with @material/web components in your Next.js application.

## Setup

### 1. Install Dependencies

The following packages should already be installed:

```bash
pnpm install @material/web @material/material-color-utilities
```

### 2. Update Your App Layout

In `app/layout.tsx`, wrap your app with the Material3Provider:

```tsx
import { Material3Provider } from '@/components/material3-provider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Material3Provider>
          {/* Your existing providers */}
          {children}
        </Material3Provider>
      </body>
    </html>
  );
}
```

### 3. Using Material Web Components

All Material Web components require the `"use client"` directive:

```tsx
"use client";

import { MaterialButton, MaterialCard } from '@/components/material';

export function MyComponent() {
  return (
    <MaterialCard variant="elevated">
      <MaterialButton 
        variant="filled" 
        label="Click me"
        onClick={() => alert('Clicked!')}
      />
    </MaterialCard>
  );
}
```

## Material 3 Expressive Features

### Corner Radius (Shapes)

The Expressive design uses larger corner radius values:

```css
--md-sys-shape-corner-extra-large: 28px;  /* Dialogs, major containers */
--md-sys-shape-corner-large: 24px;         /* Cards */
--md-sys-shape-corner-medium: 16px;        /* Buttons, smaller components */
--md-sys-shape-corner-small: 8px;          /* Minimal components */
```

### Motion & Easing

Emphasized easing is used for smooth, expressive animations:

```css
--md-sys-motion-easing-emphasized: cubic-bezier(0.2, 0, 0, 1);
```

Motion durations range from 50ms to 1000ms:

```css
--md-sys-motion-duration-short1: 50ms;     /* Quick feedback */
--md-sys-motion-duration-medium2: 300ms;   /* Standard transition */
--md-sys-motion-duration-long2: 500ms;     /* Emphasis transition */
```

### Color System

Colors are automatically generated from a source color using the material-color-utilities:

```tsx
import { useTheme } from '@/contexts/ThemeContext';

function ThemeControls() {
  const { isDark, setIsDark, sourceColor, setSourceColor } = useTheme();
  
  return (
    <div>
      <button onClick={() => setIsDark(!isDark)}>
        Toggle {isDark ? 'Light' : 'Dark'} Mode
      </button>
      <button onClick={() => setSourceColor('#FF6B6B')}>
        Change Primary Color
      </button>
    </div>
  );
}
```

## Component Usage Examples

### Buttons

```tsx
<MaterialButton variant="filled" label="Filled" />
<MaterialButton variant="outlined" label="Outlined" />
<MaterialButton variant="text" label="Text" />
<MaterialButton variant="elevated" label="Elevated" />
<MaterialButton variant="tonal" label="Tonal" />
```

### Cards

```tsx
<MaterialCard variant="elevated">
  <div style={{ padding: '16px' }}>
    Card content here
  </div>
</MaterialCard>

<MaterialCard variant="outlined">
  Outlined variant
</MaterialCard>

<MaterialCard variant="filled">
  Filled variant
</MaterialCard>
```

### Input Fields

```tsx
<MaterialTextField
  variant="filled"
  label="Email"
  type="email"
  placeholder="you@example.com"
/>

<MaterialTextField
  variant="outlined"
  label="Password"
  type="password"
  supportingText="At least 8 characters"
  error={false}
  errorText="Password is too short"
/>
```

### Checkboxes

```tsx
<MaterialCheckbox label="I agree to terms" />
<MaterialCheckbox label="Subscribe" checked={true} />
<MaterialCheckbox label="Indeterminate" indeterminate={true} />
```

### Dialogs

```tsx
<MaterialDialog open={true} onClose={() => setOpen(false)}>
  <div style={{ padding: '24px' }}>
    <h2>Dialog Title</h2>
    <p>Dialog content here</p>
  </div>
</MaterialDialog>
```

## Using Material3 Utilities

The `material3-utils` module provides helpful functions and constants:

```tsx
import {
  M3_SHAPES,
  M3_EASING,
  M3_DURATIONS,
  M3_COLOR_ROLES,
  createM3Transition,
  createM3CardStyle,
  createM3ButtonStyle,
  getContrastColor,
} from '@/utils/material3-utils';

// Create a custom card with M3 styling
const customCardStyle = createM3CardStyle();

// Create a custom transition
const transition = createM3Transition(M3_DURATIONS.LONG2, M3_EASING.EMPHASIZED);

// Get appropriate text color for a background
const textColor = getContrastColor('#6750A4');
```

## ThemeContext API

The `useTheme()` hook provides access to theme controls:

```tsx
import { useTheme } from '@/contexts/ThemeContext';

function MyComponent() {
  const { isDark, setIsDark, sourceColor, setSourceColor } = useTheme();
  
  return (
    <div>
      <p>Current mode: {isDark ? 'Dark' : 'Light'}</p>
      <p>Primary color: {sourceColor}</p>
      <button onClick={() => setIsDark(!isDark)}>Toggle Theme</button>
      <button onClick={() => setSourceColor('#6750A4')}>Reset Color</button>
    </div>
  );
}
```

## CSS Variables Available

### Colors

All Material Design 3 colors are available as CSS variables:

```css
var(--md-sys-color-primary)
var(--md-sys-color-secondary)
var(--md-sys-color-tertiary)
var(--md-sys-color-error)
var(--md-sys-color-surface)
var(--md-sys-color-on-surface)
/* ... and many more */
```

### Shapes

```css
var(--md-sys-shape-corner-extra-large)  /* 28px */
var(--md-sys-shape-corner-large)        /* 24px */
var(--md-sys-shape-corner-medium)       /* 16px */
var(--md-sys-shape-corner-small)        /* 8px */
```

### Motion

```css
var(--md-sys-motion-easing-emphasized)
var(--md-sys-motion-duration-short2)
var(--md-sys-motion-duration-medium2)
var(--md-sys-motion-duration-long2)
/* ... and many more */
```

## Best Practices

1. **Always use 'use client'** - Material Web components require client-side rendering
2. **Use the ThemeProvider** - Wrap your app to enable theme switching
3. **Leverage CSS Variables** - Use M3 tokens instead of hardcoding colors
4. **Use Material Components** - Prefer Material Web components for consistency
5. **Remember Expressive Design** - Use 28px corner radius for major containers
6. **Emphasized Motion** - Use the emphasized easing for important transitions

## Troubleshooting

### Material Web components not rendering
- Ensure you have `"use client"` at the top of your component file
- Verify Material3Provider wraps your app
- Check browser console for import errors

### Theme not applying
- Ensure ThemeContext is properly initialized
- Check that @material/material-color-utilities is installed
- Try hard-refreshing your browser

### Types not recognized
- Make sure TypeScript types are installed: `pnpm install @types/node`
- Verify imports are correct

## Resources

- [Material Design 3 Guidelines](https://m3.material.io/)
- [Material Web Components](https://github.com/material-components/material-web)
- [Material Color Utilities](https://github.com/material-foundation/material-color-utilities)
