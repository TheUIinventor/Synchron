
const useExternalTimetableByWeek = {
  Monday: {
    A: [{ period: '1', subject: 'Math' }],
    B: [{ period: '1', subject: 'English' }]
  }
};
const useExternalTimetable = {
  Monday: []
};
const currentWeek = 'A';

function buildTimetableData() {
  const filtered = {};
  for (const [day, groups] of Object.entries(useExternalTimetableByWeek)) {
    let list = [];
    if (currentWeek === 'A' || currentWeek === 'B') {
      list = Array.isArray(groups[currentWeek]) ? groups[currentWeek] : [];
    }
    
    filtered[day] = list.map(p => ({ ...p }));
    
    const daySource = useExternalTimetable && Array.isArray(useExternalTimetable[day]) ? useExternalTimetable[day] : [];
    
    // Logic from context
    if (Array.isArray(daySource) && daySource.length) {
        // ... apply variations
    }
  }
  return filtered;
}

console.log(JSON.stringify(buildTimetableData(), null, 2));
