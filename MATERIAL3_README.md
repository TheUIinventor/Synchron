# Material 3 Expressive Implementation 🎨

Complete Material Design 3 Expressive system integrated with Next.js App Router and @material/web components.

## Quick Overview

This implementation provides:

- ✅ **Material 3 Expressive Design Tokens** - 28px corner radius for major containers
- ✅ **Material Web Components** - Full-featured Material Web components with "use client" support
- ✅ **Dynamic Theming** - Change primary color and toggle light/dark mode at runtime
- ✅ **TypeScript Support** - Full type definitions for all components
- ✅ **Emphasized Motion** - Smooth, expressive animations with proper easing
- ✅ **Tailwind CSS Compatible** - Works alongside your existing Tailwind setup

## 📦 Installation

The required packages are already installed:

```bash
# Already installed in your project
@material/web
@material/material-color-utilities
```

If needed, you can install them manually:

```bash
pnpm install @material/web @material/material-color-utilities
```

## 🚀 Getting Started

### 1. Wrap Your App (Optional)

In `app/layout.tsx`:

```tsx
import { Material3Provider } from '@/components/material3-provider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Material3Provider>
          {children}
        </Material3Provider>
      </body>
    </html>
  );
}
```

### 2. Use Material Components

```tsx
"use client"; // Required for Material Web components

import { MaterialButton, MaterialCard } from '@/components/material';
import { useTheme } from '@/contexts/ThemeContext';

export function MyComponent() {
  const { isDark, setIsDark } = useTheme();

  return (
    <MaterialCard variant="elevated">
      <div style={{ padding: '24px' }}>
        <MaterialButton
          variant="filled"
          label={isDark ? 'Light Mode' : 'Dark Mode'}
          onClick={() => setIsDark(!isDark)}
        />
      </div>
    </MaterialCard>
  );
}
```

## 📚 Available Components

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
<MaterialCard variant="elevated">Content</MaterialCard>
<MaterialCard variant="outlined">Content</MaterialCard>
<MaterialCard variant="filled">Content</MaterialCard>
```

### Form Elements
```tsx
<MaterialTextField variant="filled" label="Name" />
<MaterialTextField variant="outlined" label="Email" />
<MaterialCheckbox label="I agree" />
```

### Dialogs
```tsx
<MaterialDialog open={true} onClose={() => setOpen(false)}>
  Dialog content
</MaterialDialog>
```

## 🎨 Design Tokens

### Shapes (Corner Radius)
```css
--md-sys-shape-corner-extra-large: 28px  /* Dialogs, major containers */
--md-sys-shape-corner-large: 24px        /* Cards */
--md-sys-shape-corner-medium: 16px       /* Buttons */
--md-sys-shape-corner-small: 8px         /* Minimal components */
```

### Motion
```css
--md-sys-motion-easing-emphasized: cubic-bezier(0.2, 0, 0, 1)
--md-sys-motion-duration-short2: 100ms
--md-sys-motion-duration-medium2: 300ms
--md-sys-motion-duration-long2: 500ms
```

### Colors (Auto-generated from source)
```css
var(--md-sys-color-primary)
var(--md-sys-color-secondary)
var(--md-sys-color-tertiary)
var(--md-sys-color-surface)
var(--md-sys-color-on-surface)
/* ... 40+ color tokens */
```

## 🎛️ Theme Controls

Use the `useTheme()` hook to control your theme:

```tsx
const { isDark, setIsDark, sourceColor, setSourceColor } = useTheme();

// Toggle theme
setIsDark(!isDark);

// Change primary color
setSourceColor('#FF6B6B');

// Save preferences (automatic)
// Preferences persist in localStorage
```

## 📂 Project Structure

```
components/
├── material/
│   ├── material-button.tsx
│   ├── material-card.tsx
│   ├── material-checkbox.tsx
│   ├── material-text-field.tsx
│   ├── material-dialog.tsx
│   ├── index.ts
│   └── MATERIAL3_GUIDE.md
├── material3-provider.tsx
└── material3-demo.tsx

contexts/
└── ThemeContext.tsx

utils/
└── material3-utils.ts

types/
└── material-web.d.ts

MATERIAL3_*.md (Documentation files)
```

## 🔧 Utility Functions

Access helper functions from `@/utils/material3-utils`:

```tsx
import {
  M3_SHAPES,
  M3_DURATIONS,
  M3_EASING,
  createM3Transition,
  createM3CardStyle,
  getContrastColor,
} from '@/utils/material3-utils';

// Use in custom styles
style={{
  borderRadius: M3_SHAPES.LARGE,
  transition: createM3Transition(),
  color: getContrastColor('#6750A4'),
}}
```

## 📖 Documentation

### Core Documentation
- **`MATERIAL3_SUMMARY.md`** - Overview of what's been implemented
- **`MATERIAL3_IMPLEMENTATION.md`** - Complete setup and usage guide
- **`MATERIAL3_SETUP_CHECKLIST.md`** - Verification and testing checklist

### Integration Guides
- **`MATERIAL3_TAILWIND_INTEGRATION.md`** - Using Material Web with Tailwind CSS
- **`components/material/MATERIAL3_GUIDE.md`** - Component usage examples

## 💡 Key Principles

1. **Always use "use client"** in components that use Material Web
2. **Use CSS variables** for styling Material components
3. **Leverage the theme context** for dynamic colors
4. **Respect the 28px radius** for major containers (Expressive)
5. **Use emphasized easing** for important animations

## 🎯 Example: Building a Custom Card

```tsx
"use client";

import { M3_SHAPES, M3_DURATIONS, M3_EASING } from '@/utils/material3-utils';

export function CustomCard({ title, children }) {
  return (
    <div
      style={{
        borderRadius: M3_SHAPES.LARGE,
        backgroundColor: 'var(--md-sys-color-surface-container)',
        padding: '16px',
        transition: `all ${M3_DURATIONS.MEDIUM2} ${M3_EASING.EMPHASIZED}`,
      }}
    >
      <h3 style={{ margin: '0 0 8px 0' }}>{title}</h3>
      <div>{children}</div>
    </div>
  );
}
```

## 🌙 Light/Dark Mode

The theme automatically generates colors for both light and dark modes:

```tsx
// Automatic light/dark mode
const { isDark, setIsDark } = useTheme();

// Toggle between modes
<button onClick={() => setIsDark(!isDark)}>
  {isDark ? '☀️ Light' : '🌙 Dark'}
</button>

// Preferences saved in localStorage
// Persists across page reloads
```

## 🧪 Testing Components

Use the demo component to test all Material Web components:

```tsx
import { Material3Demo } from '@/components/material3-demo';

// Add to your page
<Material3Demo />
```

This provides a complete showcase of:
- All button variants
- All card variants
- Form elements
- Dialogs
- Theme controls
- Design token reference

## ✨ Advanced: Custom Theme Colors

Create a custom theme with specific colors:

```tsx
"use client";

import { useTheme } from '@/contexts/ThemeContext';
import { useEffect } from 'react';

export function CustomTheme({ primaryColor, isDarkMode }) {
  const { setSourceColor, setIsDark } = useTheme();

  useEffect(() => {
    setSourceColor(primaryColor);
    setIsDark(isDarkMode);
  }, [primaryColor, isDarkMode]);

  return null;
}

// Usage
<CustomTheme primaryColor="#FF6B6B" isDarkMode={false} />
```

## 🐛 Troubleshooting

### Components not rendering
- ✓ Add `"use client"` to your component
- ✓ Check Material3Provider is in your layout

### Styles not applying
- ✓ Hard refresh browser (Ctrl+Shift+R)
- ✓ Check CSS variables in DevTools

### Types not recognized
- ✓ Run `pnpm install` to update types
- ✓ Restart TypeScript server in editor

## 📊 Browser Support

Material Web components work in:
- ✅ Chrome/Chromium (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)

## 📄 License

This implementation uses:
- Material Design 3 (Google)
- Material Web Components (Google)
- Material Color Utilities (Google)

## 🚀 Next Steps

1. **Review** `MATERIAL3_SETUP_CHECKLIST.md`
2. **Explore** the demo component in Material3Demo
3. **Integrate** Material components into your pages
4. **Customize** colors with setSourceColor()
5. **Build** expressive UI with 28px corner radius

---

**Ready to build with Material 3 Expressive?** Let's create something amazing! 🎉
