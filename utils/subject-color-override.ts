/**
 * Subject Colour Override System
 * Allows users to override default subject colours with custom hex colours
 */

const SUBJECT_COLOR_OVERRIDES_KEY = 'synchron-subject-color-overrides'
const SUBJECT_COLOR_PASTEL_MODE_KEY = 'synchron-subject-color-pastel-mode'

export interface SubjectColorOverrides {
  [subjectName: string]: string // subject name -> hex color (without #)
}

/**
 * Load all subject color overrides from localStorage
 */
export function loadSubjectColorOverrides(): SubjectColorOverrides {
  try {
    const raw = localStorage.getItem(SUBJECT_COLOR_OVERRIDES_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch (e) {
    return {}
  }
}

/**
 * Load pastel mode preference (whether to apply pastel filter to custom colors)
 */
export function loadPastelMode(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(SUBJECT_COLOR_PASTEL_MODE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch (e) {
    return {}
  }
}

/**
 * Get the color override for a specific subject (if any)
 */
export function getSubjectColorOverride(subject: string): string | undefined {
  const overrides = loadSubjectColorOverrides()
  return overrides[subject]
}

/**
 * Check if pastel mode is enabled for a subject
 */
export function isPastelModeEnabled(subject: string): boolean {
  const modes = loadPastelMode()
  // Default to true (pastel mode on) if not explicitly set
  return modes[subject] !== false
}

/**
 * Set a color override for a subject
 */
export function setSubjectColorOverride(subject: string, hexColor: string, usePastel: boolean = true): void {
  try {
    const overrides = loadSubjectColorOverrides()
    overrides[subject] = hexColor.replace(/^#/, '') // Store without #
    localStorage.setItem(SUBJECT_COLOR_OVERRIDES_KEY, JSON.stringify(overrides))
    
    // Store pastel mode preference
    const modes = loadPastelMode()
    modes[subject] = usePastel
    localStorage.setItem(SUBJECT_COLOR_PASTEL_MODE_KEY, JSON.stringify(modes))
    
    // Dispatch event for other components to update
    window.dispatchEvent(new CustomEvent('synchron:subject-colors-updated', { detail: { subject } }))
  } catch (e) {
    console.error('Error saving subject color override:', e)
  }
}

/**
 * Reset color override for a subject (remove it)
 */
export function resetSubjectColorOverride(subject: string): void {
  try {
    const overrides = loadSubjectColorOverrides()
    delete overrides[subject]
    localStorage.setItem(SUBJECT_COLOR_OVERRIDES_KEY, JSON.stringify(overrides))
    
    // Also remove pastel mode for this subject
    const modes = loadPastelMode()
    delete modes[subject]
    localStorage.setItem(SUBJECT_COLOR_PASTEL_MODE_KEY, JSON.stringify(modes))
    
    window.dispatchEvent(new CustomEvent('synchron:subject-colors-updated', { detail: { subject } }))
  } catch (e) {
    console.error('Error resetting subject color override:', e)
  }
}

/**
 * Reset all color overrides
 */
export function resetAllSubjectColorOverrides(): void {
  try {
    localStorage.removeItem(SUBJECT_COLOR_OVERRIDES_KEY)
    localStorage.removeItem(SUBJECT_COLOR_PASTEL_MODE_KEY)
    window.dispatchEvent(new CustomEvent('synchron:subject-colors-updated', { detail: { subject: 'all' } }))
  } catch (e) {
    console.error('Error resetting all subject color overrides:', e)
  }
}
