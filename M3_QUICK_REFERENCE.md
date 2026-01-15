# Material 3 Expressive Design - Quick Reference Guide

## Most Common Classes

### Corners (Border Radius)
```
rounded-[28px]  - Large containers, buttons, dialogs
rounded-[24px]  - Medium containers, cards, navigation
rounded-[16px]  - Alerts, medium UI elements
rounded-[12px]  - Badges, menu items, inputs, small UI
```

### Transitions
```
transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]  - Standard UI transition
transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]  - Card/container transition
transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)]  - Large transitions
```

### Interactions
```
active:scale-95  - Press feedback (buttons, menu items)
hover:bg-surface-variant  - Hover state for surfaces
hover:text-on-surface  - Hover state for text
```

### Animations
```
animate-m3-fade-in   - Fade in (300ms)
animate-m3-scale-in  - Scale in (300ms)
animate-m3-slide-up  - Slide up (400ms)
animate-m3-pop       - Pop with overshoot (500ms)
```

## Color System

### Light Mode
```
Primary:       260 45% 72%  (soft lavender)
Secondary:    290 30% 70%   (soft mauve)
Tertiary:     30  60% 75%   (soft peach)
Background:   280 40% 98%   (soft background)
Surface:      270 35% 96%   (primary surface)
```

### Dark Mode
```
Primary:       250 55% 70%  (soft blue-purple)
Secondary:    270 35% 65%   (soft purple)
Tertiary:     25  60% 70%   (soft coral)
Background:   250 18% 12%   (dark background)
Surface:      250 15% 16%   (dark surface)
```

## Component Patterns

### Button
```tsx
<Button className="rounded-[28px] transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:scale-95">
  Click me
</Button>
```

### Card
```tsx
<div className="rounded-[24px] bg-card p-4 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-surface-container-high">
  Content
</div>
```

### Badge/Label
```tsx
<div className="rounded-[12px] bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
  Label
</div>
```

### Menu Item
```tsx
<button className="rounded-[12px] px-3 py-2 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-surface-variant">
  Menu Item
</button>
```

### Loading State
```tsx
<Loader2 className="h-10 w-10 animate-spin text-primary m3-spinner" />
```

### Dialog/Modal
```tsx
<div className="fixed rounded-[28px] bg-background p-6 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]">
  Content
</div>
```

## Spacing Guide

```
Gap/Padding sizes:
gap-xs  (4px)    - Minimal spacing
gap-sm  (8px)    - Small spacing
gap-md  (12px)   - Default spacing
gap-lg  (16px)   - Medium spacing
gap-xl  (24px)   - Large spacing
gap-2xl (32px)   - Extra large spacing
```

## Typography

Typography remains unchanged but pairs well with M3:
- Use system font stack for consistency
- Maintain current font weights
- Apply M3 colors for visual hierarchy

## Common Pitfalls to Avoid

❌ **Don't use:**
- `rounded-full` (use `rounded-[28px]` instead)
- `rounded-md` / `rounded-lg` (use specific M3 radii)
- `ease-out` / `ease-in` (use emphasized easing)
- `duration-500` for standard interactions (use 200-300ms)
- `shadow-*` classes (flat design principle)
- `opacity-*` on hover (use color changes instead)

✅ **Do use:**
- Specific M3 corner radius values
- Emphasized easing for all transitions
- Proper motion durations (50-500ms)
- Color state changes for feedback
- Scale transforms for interaction feedback
- M3 color tokens for consistency

## Testing Checklist

When updating components:
- [ ] Corner radius uses M3 values
- [ ] Transitions use emphasized easing
- [ ] Duration is appropriate (50-500ms)
- [ ] Active/hover states use `scale-95` or color
- [ ] No shadows (flat design)
- [ ] Colors use CSS variable tokens
- [ ] Animations use M3 keyframes if applicable
- [ ] Responsive behavior maintained
- [ ] Accessibility (focus, disabled) preserved

## Debugging

### Check transitions
```css
/* All transitions should look like this */
transition: all 200ms cubic-bezier(0.2,0,0,1);
```

### Verify colors
```css
/* Use CSS variables, not hardcoded colors */
background-color: hsl(var(--primary) / <alpha-value>);
```

### Test animations
```css
/* Should be smooth and not janky */
animation: m3-fade-in 300ms cubic-bezier(0.2,0,0,1) forwards;
```

## Resources

- Material Design 3: https://m3.material.io/
- Expressive Style: https://m3.material.io/styles/motion
- Color System: https://m3.material.io/styles/color
- Implementation Docs: `./M3_EXPRESSIVE_IMPLEMENTATION.md`

## Questions?

Refer to the full implementation guide in `M3_EXPRESSIVE_IMPLEMENTATION.md` for detailed information about the design system.
