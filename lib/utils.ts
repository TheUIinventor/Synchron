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
  let i = 0
  while (i < parts.length - 1 && /^[A-Z]{1,4}$/.test(parts[i])) i++
  const rest = parts.slice(i).join(' ')
  return rest || s
}
