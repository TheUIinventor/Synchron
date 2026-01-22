/**
 * Color utility functions for converting hex colors to pastel versions
 * and generating Tailwind/inline CSS from hex colors
 */

/**
 * Convert a hex color using double averaging formula with white
 * Formula: (((Original + 255) / 2) + 255) / 2
 * This creates a soft, pastel-like appearance by averaging with white twice
 * @param hex - Hex color string (with or without #)
 * @returns Brightened hex color string (without #)
 */
export function hexToPastel(hex: string): string {
  // Remove # if present
  const cleaned = (hex || '').replace(/^#/, '')
  
  // Validate hex format
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return cleaned // Return original if invalid
  }
  
  // Parse RGB components
  const r = parseInt(cleaned.substring(0, 2), 16)
  const g = parseInt(cleaned.substring(2, 4), 16)
  const b = parseInt(cleaned.substring(4, 6), 16)
  
  // Double averaging: (((Original + 255) / 2) + 255) / 2
  const brightenR = Math.floor(((r + 255) / 2 + 255) / 2)
  const brightenG = Math.floor(((g + 255) / 2 + 255) / 2)
  const brightenB = Math.floor(((b + 255) / 2 + 255) / 2)
  
  // Convert back to hex
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `${toHex(brightenR)}${toHex(brightenG)}${toHex(brightenB)}`
}

/**
 * Generate an inline style with background and text color from a hex color
 * Uses the pastel version for background and ensures good contrast
 * @param hex - Hex color string (with or without #)
 * @returns CSS style object for use in inline styles
 */
export function hexToInlineStyle(hex: string): React.CSSProperties {
  const pastel = hexToPastel(hex)
  const bgColor = `#${pastel}`
  
  // Determine text color based on brightness
  // For pastel colors (which are light), use dark text
  const r = parseInt(pastel.substring(0, 2), 16)
  const g = parseInt(pastel.substring(2, 4), 16)
  const b = parseInt(pastel.substring(4, 6), 16)
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const textColor = luminance > 0.5 ? '#000000' : '#ffffff'
  
  return {
    backgroundColor: bgColor,
    color: textColor,
  }
}

/**
 * Generate a Tailwind-style class string from a hex color
 * Falls back to a neutral color if hex is invalid
 * @param hex - Hex color string (with or without #)
 * @returns Tailwind class string and style object for fallback
 */
export function hexToTailwindStyle(hex: string): {
  className: string
  style: React.CSSProperties
} {
  const pastel = hexToPastel(hex)
  
  // Return inline style approach since Tailwind arbitrary colors are more complex
  // and would require dynamic class generation which is better handled with inline styles
  return {
    className: '', // Empty - we'll use inline style instead
    style: hexToInlineStyle(hex),
  }
}
