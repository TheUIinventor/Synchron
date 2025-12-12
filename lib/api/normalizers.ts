// Lightweight normalization helpers for substitutions/variations
export function normalizeVariation(obj: any) {
  if (!obj || typeof obj !== 'object') return null
  const casualSurname = obj.casualSurname || obj.casual_name || obj.casual || null
  const substituteFull = casualSurname ? (obj.casual ? `${obj.casual} ${casualSurname}` : casualSurname) : (obj.substituteFullName || obj.substituteFull || null)
  return {
    id: obj.id || obj.variationId || obj.vid || null,
    date: obj.date || obj.day || obj.when || null,
    period: obj.period || obj.periodName || obj.t || null,
    subject: obj.subject || obj.class || obj.title || null,
    originalTeacher: obj.teacher || obj.originalTeacher || obj.teacherName || null,
    substituteTeacher: obj.substitute || obj.replacement || obj.replacementTeacher || obj.substituteTeacher || obj.casual || null,
    casual: obj.casual || null,
    casualSurname: casualSurname || null,
    substituteTeacherFull: substituteFull || null,
    fromRoom: obj.fromRoom || obj.from || obj.oldRoom || null,
    toRoom: obj.toRoom || obj.to || obj.room || obj.newRoom || null,
    reason: obj.reason || obj.note || obj.comment || null,
    raw: obj,
  }
}

export function collectFromJson(data: any) {
  const collected: any[] = []
  const push = (v: any) => {
    if (!v) return
    if (Array.isArray(v)) v.forEach((x) => {
      const n = normalizeVariation(x)
      if (n) collected.push(n)
    })
    else if (typeof v === 'object') {
      const n = normalizeVariation(v)
      if (n) collected.push(n)
    }
  }

  if (!data) return collected
  if (Array.isArray(data.variations)) push(data.variations)
  if (Array.isArray(data.classVariations)) push(data.classVariations)
  if (Array.isArray(data.days)) {
    data.days.forEach((d: any) => {
      if (Array.isArray(d.variations)) push(d.variations)
      if (Array.isArray(d.classVariations)) push(d.classVariations)
    })
  }
  if (data.timetable && Array.isArray(data.timetable.variations)) push(data.timetable.variations)

  const search = (obj: any) => {
    if (!obj || typeof obj !== 'object') return
    for (const k of Object.keys(obj)) {
      const v = obj[k]
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
        const keys = Object.keys(v[0]).join('|').toLowerCase()
        if (keys.includes('substitute') || keys.includes('variation') || keys.includes('room') || keys.includes('teacher')) push(v)
      } else if (typeof v === 'object') search(v)
    }
  }

  search(data)
  return collected
}
