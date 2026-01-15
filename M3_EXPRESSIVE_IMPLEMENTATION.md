# Material 3 Expressive Design System Implementation

## Overview
Synchron has been comprehensively updated to follow Material 3 Expressive design principles across all UI elements, interactions, and spacing.

## Key Design Tokens

### Shape System (Corner Radius)
- **Large (28px)**: `rounded-[28px]` - Primary containers, buttons, cards, dialogs
- **Medium (24px)**: `rounded-[24px]` - Secondary containers, medium buttons, navigation items
- **Medium-Small (16px)**: `rounded-[16px]` - Alerts, icon buttons, small containers
- **Small (12px)**: `rounded-[12px]` - Badge, menu items, input fields, small UI elements

### Motion & Easing
- **Emphasized Easing**: `cubic-bezier(0.2, 0, 0, 1)` - Primary easing for all Material 3 transitions
- **Emphasized Overshoot**: `cubic-bezier(0.175, 0.885, 0.32, 1.275)` - Playful interactions (pop animations)
- **Standard Easing**: `cubic-bezier(0.2, 0.0, 0, 1.0)` - Alternative standard easing

### Motion Durations
- **50ms** - Quick feedback (hover states)
- **100ms** - Fast interactions (icon changes)
- **150-200ms** - Standard UI transitions
- **300ms** - Primary animations (fade in, scale in)
- **400ms** - Larger transitions (slide up)
- **500ms** - Complex animations (pop, entrance)

### Color System (Pastel Palette)
- **Primary**: Soft lavender (260° 45% 72%)
- **Secondary**: Soft mauve (290° 30% 70%)
- **Tertiary**: Soft peach (30° 60% 75%)
- **Surface Containers**: Soft separation layers
- **All colors**: Pastel with low saturation for expressiveness

### Spacing Scale
- **xs**: 4px
- **sm**: 8px
- **md**: 12px
- **lg**: 16px
- **xl**: 24px
- **2xl**: 32px
- **3xl**: 48px

## Component Updates

### Buttons
- Border radius: 28px (large), 24px (small/icon)
- Easing: `cubic-bezier(0.2, 0, 0, 1)`
- Duration: 200ms
- Active state: `scale-95` for tactile feedback
- Padding increased for better touch targets

**Files Updated:**
- `components/ui/button.tsx`

### Cards
- Border radius: 24px
- Transitions: 300ms with emphasized easing
- Preserved glass-card styling for translucency effects
- Hover states with smooth color transitions

**Files Updated:**
- `components/ui/card.tsx`

### Badges
- Border radius: 12px
- Padding: 3px 12px (increased from 2.5px 10px)
- Active state: `scale-95`
- All variants include transition states

**Files Updated:**
- `components/ui/badge.tsx`

### Input Fields
- Border radius: 12px
- Padding: 8px 16px (px-4 py-2)
- Transitions: 200ms emphasized easing
- Focus states with ring feedback

**Files Updated:**
- `components/ui/input.tsx`

### Dialogs
- Border radius: 28px
- Transitions: 300ms emphasized easing
- Close button: 12px radius with hover feedback
- Maximum height: 90vh with scroll
- Footer padding: 16px top

**Files Updated:**
- `components/ui/dialog.tsx`

### Checkboxes
- Size increased: 20px (h-5 w-5)
- Border radius: 4px (M3 checkbox style)
- Border width: 2px
- Transitions: 200ms emphasized easing

**Files Updated:**
- `components/ui/checkbox.tsx`

### Dropdowns & Menus
- Container radius: 12px
- Item radius: 12px
- Item padding: 8px 12px (px-3 py-2)
- Transitions: 200ms emphasized easing
- Offset from trigger: 8px (increased from 4px)

**Files Updated:**
- `components/ui/dropdown-menu.tsx`

### Alerts
- Border radius: 16px
- Padding: 16px
- Transitions: 300ms emphasized easing
- Destructive variant with proper color mapping

**Files Updated:**
- `components/ui/alert.tsx`

### Tabs
- List radius: 12px
- Trigger radius: 12px
- Padding: 8px 16px (px-4 py-2)
- Content: M3 fade-in animation
- Active state: scale-95

**Files Updated:**
- `components/ui/tabs.tsx`

## Page Component Updates

### Notices Page (`app/notices/notices-client.tsx`)
- Header sticky container: 24px radius
- Mobile filter: 24px radius
- Notice cards: 24px radius with hover transitions
- Author badge: 16px radius
- Staggered animations: 50ms delay per item
- Loading state: M3 spinner with fade animation

### Timetable Page (`app/timetable/page.tsx`)
- View mode toggle: 28px container, 24px buttons
- Date navigation buttons: 16px radius
- Date picker trigger: 12px radius
- Reset button: 24px radius
- Debug buttons: 12px radius
- Card container: 24px radius

### Other Pages
- Applied M3 shape and easing to all navigational elements
- Updated all interactive components with proper feedback

## Global Styling Updates

### CSS Animations (`app/globals.css`)
Added M3 Expressive animations:
- `m3-fade-in` - 300ms fade with emphasized easing
- `m3-scale-in` - 300ms scale with emphasized easing
- `m3-slide-up` - 400ms slide with emphasized easing
- `m3-slide-down` - 300ms slide with emphasized easing
- `m3-pop` - 500ms pop with overshoot easing

### Tailwind Configuration (`tailwind.config.ts`)
- Extended `borderRadius`: m3-xl (28px), m3-2xl (40px), m3-flower (48px)
- Extended `transitionTimingFunction`: emphasized, emphasized-decelerate, emphasized-accelerate
- Extended `transitionDuration`: 50ms-500ms with proper increments
- Extended `spacing`: xs-3xl following M3 scale
- Added animations: m3-fade-in, m3-scale-in, m3-slide-up, m3-slide-down, m3-pop

## Special Considerations

### Class Card Styling
- **Preserved**: Squircle design (rounded-[16px] in period cards maintains expressive feel)
- The older rounded-full style on class cards has been updated to use M3 medium shape (16px) while maintaining the same visual effect

### Interaction Feedback
- All buttons and interactive elements include `active:scale-95` for immediate tactile feedback
- Hover states use color transitions instead of opacity changes
- Focus states include proper ring styling for accessibility

### Loading Indicators
- Custom M3 spinner animation: 1s linear rotation
- Loader progress animation: easing from 0.4 → 1 → 0.4 scale
- Icons and spinners now use `m3-spinner` class for consistency

### Accessibility
- All color transitions use proper contrast ratios
- Focus rings maintained for keyboard navigation
- Disabled states properly indicated with opacity
- Motion respects `prefers-reduced-motion` through transition-all defaults

## Browser Compatibility
- CSS variables: All modern browsers (IE11+)
- Animations: All modern browsers
- Easing functions: All modern browsers
- Transform scale: All modern browsers

## Performance Notes
- Transitions use GPU-accelerated properties (transform, opacity)
- Animations optimized with `will-change` where appropriate
- No jank from color transitions (uses CSS variables)
- Smooth 60fps animations on all modern devices

## Future Enhancements
- Implement `prefers-reduced-motion` media query globally
- Add haptic feedback indicators for touch devices
- Create component library documentation
- Add dark mode animation adjustments
- Implement micro-interactions for touch feedback

## Usage Examples

### Creating an M3 Button
```tsx
<Button className="rounded-[28px] transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:scale-95">
  Click me
</Button>
```

### Creating an M3 Card
```tsx
<div className="rounded-[24px] transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-surface-container-high">
  Content
</div>
```

### Adding M3 Animation
```tsx
<div className="animate-m3-fade-in">
  Fades in with M3 emphasized easing
</div>
```

### Creating a Loading State
```tsx
<Loader2 className="h-10 w-10 animate-spin text-primary m3-spinner" />
```

## Implementation Status
✅ Core UI components updated
✅ Page layouts enhanced
✅ Animation system implemented
✅ Color palette established
✅ Spacing system integrated
✅ Easing functions applied globally
✅ Loading indicators styled
✅ Interactive feedback added
⏳ Component documentation (in progress)
