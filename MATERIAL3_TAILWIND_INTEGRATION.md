/**
 * Material 3 & Tailwind CSS Integration Guide
 * 
 * How to use Material Web components alongside Tailwind CSS
 */

/**
 * IMPORTANT: CSS Specificity & Material Web Components
 * 
 * Material Web components use Shadow DOM, which means:
 * - Tailwind classes won't penetrate the component's shadow
 * - You must style Material components through their CSS variables
 * - Use the provided CSS variables instead of Tailwind utilities
 * 
 * Example of what WON'T work:
 * <md-filled-button class="bg-red-500 text-white">
 *   This won't apply Tailwind styles
 * </md-filled-button>
 * 
 * Instead, use CSS variables:
 * <md-filled-button style={{
 *   '--md-sys-color-primary': '#ff0000',
 *   '--md-sys-color-on-primary': '#ffffff'
 * } as any}>
 *   This works correctly
 * </md-filled-button>
 */

/**
 * HYBRID APPROACH: Material Components + Tailwind
 * 
 * You can use both systems:
 * - Material Web components for interactive elements & complex UI
 * - Tailwind CSS for layout, spacing, and simple components
 */

import { MaterialButton, MaterialCard } from '@/components/material';

/**
 * Example 1: Material component inside Tailwind grid
 */
export function HybridLayout() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
      {/* Tailwind for layout, Material for content */}
      <MaterialCard variant="elevated">
        <div className="p-4">
          <h2 className="text-lg font-bold mb-2">Card 1</h2>
          <p className="text-sm mb-4">Content here</p>
          <MaterialButton variant="filled" label="Action" />
        </div>
      </MaterialCard>

      <MaterialCard variant="outlined">
        <div className="p-4">
          <h2 className="text-lg font-bold mb-2">Card 2</h2>
          <p className="text-sm mb-4">Content here</p>
          <MaterialButton variant="tonal" label="Action" />
        </div>
      </MaterialCard>

      <MaterialCard variant="filled">
        <div className="p-4">
          <h2 className="text-lg font-bold mb-2">Card 3</h2>
          <p className="text-sm mb-4">Content here</p>
          <MaterialButton variant="outlined" label="Action" />
        </div>
      </MaterialCard>
    </div>
  );
}

/**
 * Example 2: Custom styling with Material Web components
 * 
 * Use inline styles or CSS modules with CSS variables
 */
export function CustomStyledComponent() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Style Material components with CSS variables */}
      <MaterialButton
        variant="filled"
        label="Primary Button"
        style={{
          '--md-sys-shape-corner-medium': '16px',
          '--md-sys-motion-duration-short2': '100ms',
          '--md-sys-motion-easing-emphasized': 'cubic-bezier(0.2, 0, 0, 1)',
        } as any}
      />

      {/* Combine Material with Tailwind for layout */}
      <div className="flex gap-2">
        <MaterialButton variant="outlined" label="Secondary" />
        <MaterialButton variant="text" label="Tertiary" />
      </div>

      {/* Tailwind for spacing and Material for content */}
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-gray-700">Info</h3>
        <MaterialCard variant="elevated">
          <p className="p-4 text-sm">Card content with M3 styling</p>
        </MaterialCard>
      </div>
    </div>
  );
}

/**
 * Best Practices for Hybrid Usage
 * 
 * DO:
 * ✓ Use Tailwind for layout, spacing, and text styling
 * ✓ Use Material Web for interactive components (buttons, inputs, dialogs)
 * ✓ Use CSS variables for Material component styling
 * ✓ Keep component hierarchy clean (layout parent, M3 components children)
 * ✓ Use Material3Provider for theme management
 * 
 * DON'T:
 * ✗ Don't apply Tailwind classes directly to Material components
 * ✗ Don't mix Tailwind color utilities with Material color roles
 * ✗ Don't nest Material components deeply in Tailwind components
 * ✗ Don't forget "use client" for Material Web component files
 */

/**
 * CSS Variable Precedence
 * 
 * Material Web components read CSS variables from their context.
 * Set variables at the root or component level:
 * 
 * 1. Global level (document.documentElement):
 *    Automatic with ThemeContext
 * 
 * 2. Component level (inline styles):
 *    <md-button style={{ '--md-sys-color-primary': '#FF0000' }}>
 * 
 * 3. Scoped level (CSS modules):
 *    .buttonContainer {
 *      --md-sys-color-primary: #FF0000;
 *    }
 */

/**
 * Migration Strategy
 * 
 * If migrating from Tailwind-only to hybrid approach:
 * 
 * Phase 1: Add Material3Provider
 * - Wrap app with Material3Provider
 * - Keep existing Tailwind components
 * 
 * Phase 2: Introduce Material components
 * - Start with buttons and cards
 * - Replace Tailwind equivalents gradually
 * - Update styling to use CSS variables
 * 
 * Phase 3: Optimize
 * - Review Tailwind utilities (can remove button classes, etc.)
 * - Ensure consistent theming
 * - Test light/dark modes
 * 
 * Phase 4: Polish
 * - Add custom Material components
 * - Fine-tune animations with M3 durations
 * - Optimize spacing and layout
 */

/**
 * Available Material 3 CSS Variables
 */
const M3_VARIABLES = {
  // Shapes
  'shape-corner-extra-large': '28px',
  'shape-corner-large': '24px',
  'shape-corner-medium': '16px',
  'shape-corner-small': '8px',

  // Colors (examples - full list in material-color-utilities)
  'color-primary': 'var(--md-sys-color-primary)',
  'color-secondary': 'var(--md-sys-color-secondary)',
  'color-tertiary': 'var(--md-sys-color-tertiary)',
  'color-surface': 'var(--md-sys-color-surface)',
  'color-on-surface': 'var(--md-sys-color-on-surface)',

  // Motion
  'motion-easing-emphasized': 'cubic-bezier(0.2, 0, 0, 1)',
  'motion-easing-standard': 'cubic-bezier(0.2, 0, 0, 1)',
  'motion-duration-short2': '100ms',
  'motion-duration-medium2': '300ms',
  'motion-duration-long2': '500ms',
} as const;

/**
 * Example CSS Module for Material components
 * 
 * // styles/material-button.module.css
 * .primaryButton {
 *   --md-sys-color-primary: var(--brand-primary);
 *   --md-sys-color-on-primary: var(--brand-on-primary);
 *   --md-sys-shape-corner-medium: var(--brand-border-radius);
 * }
 * 
 * // component.tsx
 * import styles from '@/styles/material-button.module.css';
 * import { MaterialButton } from '@/components/material';
 * 
 * export function BrandButton() {
 *   return (
 *     <MaterialButton
 *       className={styles.primaryButton}
 *       variant="filled"
 *       label="Brand Button"
 *     />
 *   );
 * }
 */

/**
 * Accessibility with Material & Tailwind
 * 
 * Both systems support accessibility:
 * - Material Web: Built-in ARIA labels and keyboard navigation
 * - Tailwind: Focus states with focus:ring utilities
 * 
 * Combined approach:
 * <div className="flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-offset-2">
 *   <MaterialButton variant="filled" label="Click me" />
 * </div>
 */

export default function Guide() {
  return (
    <div className="space-y-8 p-8">
      <h1 className="text-3xl font-bold">Material 3 & Tailwind CSS Guide</h1>
      <HybridLayout />
      <CustomStyledComponent />
    </div>
  );
}
