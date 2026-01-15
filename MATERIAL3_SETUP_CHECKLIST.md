# Material 3 Expressive Setup Checklist

This checklist ensures you have properly integrated Material 3 Expressive design with @material/web components.

## ✅ Installation

- [x] `@material/web` installed
- [x] `@material/material-color-utilities` installed

```bash
pnpm install @material/web @material/material-color-utilities
```

## ✅ Core Files Created

### Theme System
- [x] `/contexts/ThemeContext.tsx` - Main theme provider with M3 Expressive tokens
- [x] `/components/material3-provider.tsx` - Next.js wrapper for Material3Provider

### Material Web Component Wrappers
- [x] `/components/material/material-button.tsx` - Button wrapper
- [x] `/components/material/material-card.tsx` - Card wrapper
- [x] `/components/material/material-checkbox.tsx` - Checkbox wrapper
- [x] `/components/material/material-text-field.tsx` - Text field wrapper
- [x] `/components/material/material-dialog.tsx` - Dialog wrapper
- [x] `/components/material/index.ts` - Component exports

### Utilities & Documentation
- [x] `/utils/material3-utils.ts` - Helper functions and M3 constants
- [x] `/types/material-web.d.ts` - TypeScript type definitions
- [x] `/components/material/MATERIAL3_GUIDE.md` - Component usage guide
- [x] `/MATERIAL3_IMPLEMENTATION.md` - Complete implementation guide

## ⚙️ Integration Steps

### Step 1: Update Your Layout (Optional - only if replacing existing provider)

In `app/layout.tsx`, if you want to use Material3Provider:

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

### Step 2: Use Material Components in Your Pages

Add `"use client"` and import Material components:

```tsx
"use client";

import { MaterialButton, MaterialCard } from '@/components/material';
import { useTheme } from '@/contexts/ThemeContext';

export default function MyPage() {
  const { isDark, setIsDark } = useTheme();
  
  return (
    <MaterialCard variant="elevated">
      <MaterialButton 
        variant="filled"
        label="Toggle Theme"
        onClick={() => setIsDark(!isDark)}
      />
    </MaterialCard>
  );
}
```

### Step 3: Import Material Web Components

Individual components can be imported:

```tsx
import '@material/web/button/filled-button';
import '@material/web/card/elevated-card';
import '@material/web/textfield/outlined-text-field';
```

Or use the all-in-one import (in Material3Provider):

```tsx
import '@material/web/all';
```

## 🎨 Key Features Implemented

### Expressive Shape Corners
- Extra-large containers: **28px** (dialogs, major containers)
- Large components: **24px** (cards)
- Medium components: **16px** (buttons)
- Small components: **8px** (minimal UI)

### Emphasized Motion
- Easing: `cubic-bezier(0.2, 0, 0, 1)`
- Smooth, expressive animations
- Recommended for primary interactions

### Color System
- Source color: `#6750A4` (deep purple)
- Dynamically generated color tokens
- Full light and dark mode support
- Automatic contrast checking

### Motion Durations
- Short: 50ms - 200ms
- Medium: 250ms - 400ms
- Long: 450ms - 600ms
- Extra-long: 700ms - 1000ms

## 🧪 Testing Your Setup

### Test 1: Theme Context Works
```tsx
"use client";
import { useTheme } from '@/contexts/ThemeContext';

export function TestTheme() {
  const { isDark, setIsDark } = useTheme();
  
  return (
    <button onClick={() => setIsDark(!isDark)}>
      {isDark ? 'Light' : 'Dark'} Mode
    </button>
  );
}
```

### Test 2: Material Button Works
```tsx
"use client";
import { MaterialButton } from '@/components/material';

export function TestButton() {
  return (
    <MaterialButton 
      variant="filled" 
      label="Click me"
      onClick={() => alert('Works!')}
    />
  );
}
```

### Test 3: CSS Variables Applied
Open browser DevTools Console and check:
```javascript
getComputedStyle(document.documentElement).getPropertyValue('--md-sys-shape-corner-extra-large')
// Should return: " 28px"
```

## 📦 CSS Variables Reference

### Colors (auto-generated)
```css
--md-sys-color-primary
--md-sys-color-secondary
--md-sys-color-tertiary
--md-sys-color-surface
--md-sys-color-on-surface
/* ... 40+ color tokens */
```

### Shapes (Expressive)
```css
--md-sys-shape-corner-extra-large: 28px
--md-sys-shape-corner-large: 24px
--md-sys-shape-corner-medium: 16px
--md-sys-shape-corner-small: 8px
```

### Motion (Emphasized)
```css
--md-sys-motion-easing-emphasized: cubic-bezier(0.2, 0, 0, 1)
--md-sys-motion-duration-short1: 50ms
--md-sys-motion-duration-medium2: 300ms
--md-sys-motion-duration-long2: 500ms
/* ... 16 duration tokens */
```

## 🔧 TypeScript Support

Type definitions are included in `/types/material-web.d.ts`:

```tsx
// These types are now recognized
<md-filled-button disabled={false}>Button</md-filled-button>
<md-elevated-card>Card</md-elevated-card>
<md-checkbox checked={true} />
```

## 🎯 Next Steps

1. **Start using Material components** in your pages (remember `"use client"`)
2. **Replace Tailwind components** gradually with Material Web equivalents
3. **Customize colors** using `useTheme().setSourceColor('#yourColor')`
4. **Create custom components** following the wrapper patterns
5. **Test in both light and dark modes**

## 📚 Documentation Files

- `MATERIAL3_IMPLEMENTATION.md` - Full implementation guide
- `components/material/MATERIAL3_GUIDE.md` - Component usage examples
- `utils/material3-utils.ts` - Utility functions and constants
- `types/material-web.d.ts` - TypeScript definitions

## ⚠️ Common Issues & Solutions

### Issue: Components not rendering
**Solution**: Make sure you have `"use client"` directive at the top of the file

### Issue: Styles not applying
**Solution**: 
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Check Material3Provider is in your layout

### Issue: Types not recognized
**Solution**: 
1. Ensure `types/material-web.d.ts` exists
2. Run `pnpm install` to update types
3. Restart TypeScript server in your editor

## ✨ You're Ready!

Your Material 3 Expressive design system is fully set up. Start creating beautiful, expressive interfaces with M3 components and tokens!
