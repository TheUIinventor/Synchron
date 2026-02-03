const fs = require('fs');
const path = require('path');

function loadSample() {
  const p = path.join(__dirname, 'sample-timetable.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function inferDayWeek(dayObj) {
  if (!dayObj) return null;
  const rawWeek = (dayObj.weekType || dayObj.week_type || dayObj.week || dayObj.weekLabel || dayObj.rotation || dayObj.cycle) || null;
  let letter = rawWeek ? String(rawWeek).trim().toUpperCase() : null;
  if (letter === 'A' || letter === 'B') return letter;
  // fallback: day name ends with A/B
  try {
    const rawName = String(dayObj.dayName || dayObj.dayname || dayObj.day || dayObj.title || '').trim();
    const m = rawName.match(/([AB])$/i);
    if (m && m[1]) return m[1].toUpperCase();
  } catch (e) {}
  return null;
}

function resolveDayKey(dayObj) {
  if (!dayObj) return null;
  if (dayObj.date) {
    const d = new Date(dayObj.date);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('en-US', { weekday: 'long' });
  }
  const rawName = String(dayObj.dayName || dayObj.dayname || dayObj.day || '').toLowerCase();
  if (rawName.includes('mon')) return 'Monday';
  if (rawName.includes('tue')) return 'Tuesday';
  if (rawName.includes('wed')) return 'Wednesday';
  if (rawName.includes('thu') || rawName.includes('thur')) return 'Thursday';
  if (rawName.includes('fri')) return 'Friday';
  return null;
}

function applyFilter(payload) {
  const finalTimetable = JSON.parse(JSON.stringify(payload.timetable || {}));
  const dayObj = payload.upstream && payload.upstream.day ? payload.upstream.day : null;
  const inferred = inferDayWeek(dayObj);
  const dayKey = resolveDayKey(dayObj);
  console.log('inferred day week:', inferred, 'dayKey:', dayKey);
  if (inferred && dayKey && Array.isArray(finalTimetable[dayKey])) {
    finalTimetable[dayKey] = finalTimetable[dayKey].filter(p => !(p && p.weekType) || String(p.weekType).toUpperCase() === inferred);
  }
  return finalTimetable;
}

function main() {
  const payload = loadSample();
  const before = payload.timetable.Monday.map(p => ({ period: p.period, subject: p.subject, room: p.room, weekType: p.weekType }));
  console.log('Before filter (Monday):', before);
  const after = applyFilter(payload);
  const afterMonday = (after.Monday || []).map(p => ({ period: p.period, subject: p.subject, room: p.room, weekType: p.weekType }));
  console.log('After filter (Monday):', afterMonday);
  const p3 = afterMonday.find(p => p.period === '3');
  console.log('Period 3 after filter:', p3);
}

main();
