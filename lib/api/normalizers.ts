import { PortalScraper } from './portal-scraper'

// Provide a small compatibility layer expected by server routes.
export function collectFromJson(j: any) {
  try {
    return PortalScraper.extractVariationsFromJson(j)
  } catch (e) {
    return []
  }
}

// Normalize a single variation-like object into the shape used by the app.
export function normalizeVariation(v: any) {
  if (!v || typeof v !== 'object') return null
  const id = v.id || v.variationId || v.vid || undefined
  return {
    id,
    date: v.date || v.day || v.when || undefined,
    period: v.period || v.periodName || v.t || v.p || undefined,
    subject: v.subject || v.class || v.title || undefined,
    originalTeacher: v.originalTeacher || v.teacher || v.teacherName || undefined,
    casual: v.casual || undefined,
    casualSurname: v.casualSurname || undefined,
    substituteTeacher: v.substituteTeacher || v.substitute || v.replacement || v.replacementTeacher || undefined,
    substituteTeacherFull: v.substituteTeacherFull || v.substituteFullName || v.substituteFull || (v.casual ? (v.casualSurname ? `${v.casual} ${v.casualSurname}` : v.casual) : undefined) || undefined,
    fromRoom: v.fromRoom || v.from || v.oldRoom || undefined,
    toRoom: v.toRoom || v.to || v.room || v.newRoom || undefined,
    reason: v.reason || v.note || v.comment || undefined,
    raw: v.raw || v,
  }
}

export default { collectFromJson, normalizeVariation }
