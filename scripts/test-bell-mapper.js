// Simple test script to validate bell-to-bucket mapping logic
const bj = {
  day: 'Wednesday',
  bells: [
    { period: '0', startTime: '08:00', endTime: '08:57', type: 'O', time: '08:00', bell: '0', bellDisplay: 'Period 0' },
    { period: 'RC', startTime: '08:57', endTime: '09:00', type: 'O', time: '08:57', bell: 'RC', bellDisplay: 'Roll Call' },
    { period: '1', startTime: '09:00', endTime: '10:00', type: 'T', time: '09:00', bell: '1', bellDisplay: 'Period 1' },
    { period: '2', startTime: '10:05', endTime: '11:05', type: 'T', time: '10:05', bell: '2', bellDisplay: 'Period 2' },
    { period: 'R', startTime: '11:05', endTime: '11:22', type: 'R', time: '11:05', bell: 'R', bellDisplay: 'Recess' },
    { period: '3', startTime: '11:25', endTime: '12:25', type: 'T', time: '11:25', bell: '3', bellDisplay: 'Period 3' },
    { period: 'WFL1', startTime: '12:25', endTime: '12:45', type: 'R', time: '12:25', bell: 'WFL1', bellDisplay: 'Lunch 1' },
    { period: 'WFL2', startTime: '12:45', endTime: '13:02', type: 'R', time: '12:45', bell: 'WFL2', bellDisplay: 'Lunch 2' },
    { period: '4', startTime: '13:05', endTime: '14:05', type: 'T', time: '13:05', bell: '4', bellDisplay: 'Period 4' },
    { period: '5', startTime: '14:10', endTime: '15:10', type: 'T', time: '14:10', bell: '5', bellDisplay: 'Period 5' },
    { period: 'EoD', startTime: '15:10', endTime: null, type: 'O', time: '15:10', bell: 'EoD', bellDisplay: 'End of Day' }
  ]
}

function mapBellsToBuckets(bj) {
  const bellsArr = Array.isArray(bj) ? bj : (bj.bells || bj.periods || [])
  const bellLabelMap = { RC: 'Roll Call', R: 'Recess', MTL1: 'Lunch 1', MTL2: 'Lunch 2', MTL: 'Lunch', L: 'Lunch' }
  const schedules = { 'Mon/Tues': [], 'Wed/Thurs': [], Fri: [] }
  const bellSources = { 'Mon/Tues': 'empty', 'Wed/Thurs': 'empty', Fri: 'empty' }
  const topLevelDayRaw = (bj && (bj.day || bj.date || bj.dayName || bj.dayname)) ? String(bj.day || bj.date || bj.dayName || bj.dayname).toLowerCase() : null
  if (topLevelDayRaw) {
    const target = topLevelDayRaw.includes('fri') ? 'Fri' : (topLevelDayRaw.includes('wed') || topLevelDayRaw.includes('thu') || topLevelDayRaw.includes('thur')) ? 'Wed/Thurs' : 'Mon/Tues'
    const mappedAll = (bellsArr || []).map((b) => {
      const rawLabel = String(b.period || b.name || b.title || b.bellDisplay || '').trim()
      const key = rawLabel.toUpperCase()
      const friendly = bellLabelMap[key] || (b.bellDisplay || rawLabel)
      const bs = b.start || b.startTime || b.timeStart || b.from || b.start_time || b.starttime
      const be = b.end || b.endTime || b.timeEnd || b.to || b.end_time || b.endtime
      const timeStr = [bs, be].filter(Boolean).join(' - ')
      return { period: String(friendly || rawLabel), originalPeriod: rawLabel, time: timeStr }
    })
    schedules[target] = schedules[target].concat(mappedAll)
    bellSources[target] = 'api'
  } else {
    for (const b of bellsArr) {
      const rawLabel = String(b.period || b.name || b.title || b.bellDisplay || '').trim()
      const key = rawLabel.toUpperCase()
      const friendly = bellLabelMap[key] || (b.bellDisplay || rawLabel)
      const bs = b.start || b.startTime || b.timeStart || b.from || b.start_time || b.starttime
      const be = b.end || b.endTime || b.timeEnd || b.to || b.end_time || b.endtime
      const timeStr = [bs, be].filter(Boolean).join(' - ')
      const entry = { period: String(friendly || rawLabel), originalPeriod: rawLabel, time: timeStr }
      const pattern = (b.dayPattern || b.pattern || b.day || '').toString().toLowerCase()
      if (pattern.includes('mon') || pattern.includes('tue')) { schedules['Mon/Tues'].push(entry); bellSources['Mon/Tues'] = 'api' }
      else if (pattern.includes('wed') || pattern.includes('thu') || pattern.includes('thur')) { schedules['Wed/Thurs'].push(entry); bellSources['Wed/Thurs'] = 'api' }
      else if (pattern.includes('fri')) { schedules['Fri'].push(entry); bellSources['Fri'] = 'api' }
      else { schedules['Mon/Tues'].push(entry); if (bellSources['Mon/Tues'] === 'empty') bellSources['Mon/Tues'] = 'api' }
    }
  }
  return { schedules, bellSources }
}

const result = mapBellsToBuckets(bj)
console.log(JSON.stringify(result, null, 2))
