/**
 * Subject Color Override System
 * Allows users to override default subject colors with custom hex colors
 */

const SUBJECT_COLOR_OVERRIDES_KEY = 'synchron-subject-color-overrides'

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
 * Get the color override for a specific subject (if any)
 */
export function getSubjectColorOverride(subject: string): string | undefined {
  const overrides = loadSubjectColorOverrides()
  return overrides[subject]
}

/**
 * Set a color override for a subject
 */
export function setSubjectColorOverride(subject: string, hexColor: string): void {
  try {
    const overrides = loadSubjectColorOverrides()
    overrides[subject] = hexColor.replace(/^#/, '') // Store without #
    localStorage.setItem(SUBJECT_COLOR_OVERRIDES_KEY, JSON.stringify(overrides))
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
    window.dispatchEvent(new CustomEvent('synchron:subject-colors-updated', { detail: { subject: 'all' } }))
  } catch (e) {
    console.error('Error resetting all subject color overrides:', e)
  }
}
