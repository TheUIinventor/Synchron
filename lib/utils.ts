import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Remove leading short casual codes (e.g. "LIKV V") from substitute full-names.
// If the name begins with one or more short all-caps tokens (length <= 4),
// strip them and return the remainder. Otherwise return the original name.
export function stripLeadingCasualCode(name?: string | null) {
  if (!name) return ''
  const s = String(name).trim()
  if (!s) return ''
  const parts = s.split(/\s+/)
  // Only strip a run of leading ALL-CAPS tokens when they are followed by
  // other ALL-CAPS tokens. Preserve a single-letter initial when it precedes
  // a proper-case surname (e.g. `V Likourezos`) so we don't drop the initial.
  let i = 0
  while (i < parts.length - 1) {
    const cur = parts[i]
    const next = parts[i + 1]
    const curAllCaps = /^[A-Z]{1,4}$/.test(cur)
    const nextAllCaps = /^[A-Z]{1,4}$/.test(next)
    if (curAllCaps && nextAllCaps) {
      // strip this token and continue
      i++
      continue
    }
    // If current token is ALL-CAPS but the next token is NOT all-caps,
    // assume the next token is a proper surname and stop stripping so that
    // single-letter initials (e.g. `V`) are preserved.
    break
  }
  const rest = parts.slice(i).join(' ')
  return rest || s
}
