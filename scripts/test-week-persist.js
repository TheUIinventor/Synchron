// Simulate selection persistence logic across refreshes
function computeSelectedWeek({currentWeek, externalWeekType, useExternalTimetableByWeek, useExternalTimetable, lastRecordedTimetable, selectedWeekRef}){
  let selectedWeek = 'unknown'
  if (currentWeek === 'A' || currentWeek === 'B') selectedWeek = currentWeek
  else if (externalWeekType === 'A' || externalWeekType === 'B') selectedWeek = externalWeekType
  else {
    if (selectedWeekRef.current && (externalWeekType === null || externalWeekType === undefined)) {
      selectedWeek = selectedWeekRef.current
    } else {
      // scoring fallback -- simplified: choose A if tie
      selectedWeek = 'A'
    }
  }
  selectedWeekRef.current = selectedWeek
  return selectedWeek
}

function main(){
  const selectedWeekRef = { current: null }
  // First refresh: payload with upstream.day.weekType = B
  const first = { currentWeek: null, externalWeekType: null, useExternalTimetableByWeek: true }
  // but code elsewhere sets externalWeekType when inferring day-level; simulate that
  const inferred = 'B'
  first.externalWeekType = inferred
  const s1 = computeSelectedWeek({ ...first, selectedWeekRef })
  console.log('First selectedWeek =>', s1)

  // Second refresh: no externalWeekType provided and scores tie
  const second = { currentWeek: null, externalWeekType: null, useExternalTimetableByWeek: true }
  const s2 = computeSelectedWeek({ ...second, selectedWeekRef })
  console.log('Second selectedWeek =>', s2)
}

main();
