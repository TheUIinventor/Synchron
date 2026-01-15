/**
 * Material 3 Utilities
 * 
 * Helper functions and constants for Material 3 Expressive design system
 */

/**
 * M3 Expressive Shape Corners
 */
export const M3_SHAPES = {
  EXTRA_LARGE: '28px', // Used for major containers and dialogs
  LARGE: '24px',       // Used for cards
  MEDIUM: '16px',      // Used for smaller components
  SMALL: '8px',        // Used for minimal components
} as const;

/**
 * M3 Emphasized Motion Easing
 */
export const M3_EASING = {
  // Emphasized easing for expressive motion
  EMPHASIZED: 'cubic-bezier(0.2, 0, 0, 1)',
  EMPHASIZED_DECELERATE: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
  EMPHASIZED_ACCELERATE: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
  
  // Standard M3 easing
  STANDARD: 'cubic-bezier(0.2, 0, 0, 1)',
  STANDARD_DECELERATE: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
  STANDARD_ACCELERATE: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
} as const;

/**
 * M3 Motion Durations
 */
export const M3_DURATIONS = {
  SHORT1: '50ms',
  SHORT2: '100ms',
  SHORT3: '150ms',
  SHORT4: '200ms',
  MEDIUM1: '250ms',
  MEDIUM2: '300ms',
  MEDIUM3: '350ms',
  MEDIUM4: '400ms',
  LONG1: '450ms',
  LONG2: '500ms',
  LONG3: '550ms',
  LONG4: '600ms',
  EXTRA_LONG1: '700ms',
  EXTRA_LONG2: '800ms',
  EXTRA_LONG3: '900ms',
  EXTRA_LONG4: '1000ms',
} as const;

/**
 * M3 Color Roles
 * These are automatically applied by the ThemeContext using material-color-utilities
 */
export const M3_COLOR_ROLES = {
  PRIMARY: 'var(--md-sys-color-primary)',
  ON_PRIMARY: 'var(--md-sys-color-on-primary)',
  PRIMARY_CONTAINER: 'var(--md-sys-color-primary-container)',
  ON_PRIMARY_CONTAINER: 'var(--md-sys-color-on-primary-container)',
  
  SECONDARY: 'var(--md-sys-color-secondary)',
  ON_SECONDARY: 'var(--md-sys-color-on-secondary)',
  SECONDARY_CONTAINER: 'var(--md-sys-color-secondary-container)',
  ON_SECONDARY_CONTAINER: 'var(--md-sys-color-on-secondary-container)',
  
  TERTIARY: 'var(--md-sys-color-tertiary)',
  ON_TERTIARY: 'var(--md-sys-color-on-tertiary)',
  TERTIARY_CONTAINER: 'var(--md-sys-color-tertiary-container)',
  ON_TERTIARY_CONTAINER: 'var(--md-sys-color-on-tertiary-container)',
  
  ERROR: 'var(--md-sys-color-error)',
  ON_ERROR: 'var(--md-sys-color-on-error)',
  ERROR_CONTAINER: 'var(--md-sys-color-error-container)',
  ON_ERROR_CONTAINER: 'var(--md-sys-color-on-error-container)',
  
  SURFACE: 'var(--md-sys-color-surface)',
  ON_SURFACE: 'var(--md-sys-color-on-surface)',
  SURFACE_DIM: 'var(--md-sys-color-surface-dim)',
  SURFACE_BRIGHT: 'var(--md-sys-color-surface-bright)',
  SURFACE_CONTAINER_LOWEST: 'var(--md-sys-color-surface-container-lowest)',
  SURFACE_CONTAINER_LOW: 'var(--md-sys-color-surface-container-low)',
  SURFACE_CONTAINER: 'var(--md-sys-color-surface-container)',
  SURFACE_CONTAINER_HIGH: 'var(--md-sys-color-surface-container-high)',
  SURFACE_CONTAINER_HIGHEST: 'var(--md-sys-color-surface-container-highest)',
  ON_SURFACE_VARIANT: 'var(--md-sys-color-on-surface-variant)',
  
  OUTLINE: 'var(--md-sys-color-outline)',
  OUTLINE_VARIANT: 'var(--md-sys-color-outline-variant)',
  INVERSE_SURFACE: 'var(--md-sys-color-inverse-surface)',
  INVERSE_ON_SURFACE: 'var(--md-sys-color-inverse-on-surface)',
  INVERSE_PRIMARY: 'var(--md-sys-color-inverse-primary)',
  SCRIM: 'var(--md-sys-color-scrim)',
  SHADOW: 'var(--md-sys-color-shadow)',
} as const;

/**
 * Create a Material 3 Expressive transition string
 * @param duration - Motion duration (from M3_DURATIONS)
 * @param easing - Easing function (from M3_EASING)
 * @param property - CSS property to transition (default: 'all')
 */
export function createM3Transition(
  duration: string = M3_DURATIONS.MEDIUM2,
  easing: string = M3_EASING.EMPHASIZED,
  property: string = 'all'
): string {
  return `${property} ${duration} ${easing}`;
}

/**
 * Create a Material 3 Expressive card style
 */
export function createM3CardStyle(): React.CSSProperties {
  return {
    borderRadius: M3_SHAPES.LARGE,
    backgroundColor: M3_COLOR_ROLES.SURFACE_CONTAINER,
    color: M3_COLOR_ROLES.ON_SURFACE,
    transition: createM3Transition(),
  };
}

/**
 * Create a Material 3 Expressive button style
 */
export function createM3ButtonStyle(): React.CSSProperties {
  return {
    borderRadius: M3_SHAPES.MEDIUM,
    backgroundColor: M3_COLOR_ROLES.PRIMARY,
    color: M3_COLOR_ROLES.ON_PRIMARY,
    transition: createM3Transition(M3_DURATIONS.SHORT2, M3_EASING.EMPHASIZED),
    border: 'none',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  };
}

/**
 * Create a Material 3 Expressive container (dialog/modal)
 */
export function createM3ContainerStyle(): React.CSSProperties {
  return {
    borderRadius: M3_SHAPES.EXTRA_LARGE,
    backgroundColor: M3_COLOR_ROLES.SURFACE,
    color: M3_COLOR_ROLES.ON_SURFACE,
    padding: '24px',
    transition: createM3Transition(),
  };
}

/**
 * Hex color to RGB format converter
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Get contrast text color (white or black) based on background
 */
export function getContrastColor(hexColor: string): string {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return '#000000';
  
  // Calculate luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}
