/**
 * Variation Colour Override System
 * Allows users to override default variation highlight colours (e.g., substitutes, room changes)
 */

const VARIATION_COLOR_OVERRIDES_KEY = 'synchron-variation-color-overrides'
const VARIATION_COLOR_PASTEL_MODE_KEY = 'synchron-variation-color-pastel-mode'

export interface VariationColorOverrides {
  [variationKey: string]: string // e.g. 'substitute' or 'roomChange' -> hex (without #)
}

export function loadVariationColorOverrides(): VariationColorOverrides {
  try {
    const raw = localStorage.getItem(VARIATION_COLOR_OVERRIDES_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch (e) {
    return {}
  }
}

export function loadVariationPastelMode(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(VARIATION_COLOR_PASTEL_MODE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch (e) {
    return {}
  }
}

export function getVariationColorOverride(key: string): string | undefined {
  const overrides = loadVariationColorOverrides()
  return overrides[key]
}

export function isVariationPastelModeEnabled(key: string): boolean {
  const modes = loadVariationPastelMode()
  return modes[key] !== false
}

export function setVariationColorOverride(key: string, hexColor: string, usePastel: boolean = true): void {
  try {
    const overrides = loadVariationColorOverrides()
    overrides[key] = hexColor.replace(/^#/, '')
    localStorage.setItem(VARIATION_COLOR_OVERRIDES_KEY, JSON.stringify(overrides))

    const modes = loadVariationPastelMode()
    modes[key] = usePastel
    localStorage.setItem(VARIATION_COLOR_PASTEL_MODE_KEY, JSON.stringify(modes))

    window.dispatchEvent(new CustomEvent('synchron:variation-colors-updated', { detail: { key } }))
  } catch (e) {
    console.error('Error saving variation color override:', e)
  }
}

export function resetVariationColorOverride(key: string): void {
  try {
    const overrides = loadVariationColorOverrides()
    delete overrides[key]
    localStorage.setItem(VARIATION_COLOR_OVERRIDES_KEY, JSON.stringify(overrides))

    const modes = loadVariationPastelMode()
    delete modes[key]
    localStorage.setItem(VARIATION_COLOR_PASTEL_MODE_KEY, JSON.stringify(modes))

    window.dispatchEvent(new CustomEvent('synchron:variation-colors-updated', { detail: { key } }))
  } catch (e) {
    console.error('Error resetting variation color override:', e)
  }
}

export function resetAllVariationColorOverrides(): void {
  try {
    localStorage.removeItem(VARIATION_COLOR_OVERRIDES_KEY)
    localStorage.removeItem(VARIATION_COLOR_PASTEL_MODE_KEY)
    window.dispatchEvent(new CustomEvent('synchron:variation-colors-updated', { detail: { key: 'all' } }))
  } catch (e) {
    console.error('Error resetting all variation color overrides:', e)
  }
}
