import { PortalScraper } from './portal-scraper'

export function collectFromJson(data: any) {
  try {
    return PortalScraper.extractVariationsFromJson(data)
  } catch (e) {
    return []
  }
}

export function normalizeVariation(obj: any) {
  if (!obj || typeof obj !== 'object') return obj
  const v = obj as any
  return {
    id: v.id || v.variationId || v.vid || undefined,
    date: v.date || v.day || v.when || undefined,
    period: v.period || v.periodName || v.t || undefined,
    subject: v.subject || v.class || v.title || undefined,
    originalTeacher: v.originalTeacher || v.teacher || v.teacherName || undefined,
    casual: v.casual || undefined,
    casualSurname: v.casualSurname || undefined,
    substituteTeacher: v.substitute || v.replacement || v.replacementTeacher || v.substituteTeacher || undefined,
    substituteTeacherFull: v.substituteTeacherFull || v.substituteFull || (v.casual ? (v.casualSurname ? `${v.casual} ${v.casualSurname}` : v.casual) : undefined) || undefined,
    fromRoom: v.fromRoom || v.from || v.oldRoom || undefined,
    toRoom: v.toRoom || v.to || v.room || v.newRoom || undefined,
    reason: v.reason || v.note || v.comment || undefined,
    raw: v.raw || v,
  }
}

export default { collectFromJson, normalizeVariation }
