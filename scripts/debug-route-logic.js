
const dateParam = '2025-12-15'; // A Monday
const requestedDayIndex = 1; // Monday
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Mock fullRes (Cycle Timetable) - mimicking SBHS structure
const fullRes = {
  json: {
    days: {
      "1": {
        "periods": [
          { "period": "1", "subject": "Maths", "room": "101" },
          { "period": "2", "subject": "English", "room": "102" }
        ]
      },
      "6": { // Monday B?
        "periods": [
           { "period": "1", "subject": "History", "room": "104" }
        ]
      }
    }
  }
};

const byDay = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] };

// Helper functions
const normalizeString = (v) => (v == null ? '' : String(v).trim());
const toPeriod = (p) => ({
    period: normalizeString(p.period),
    subject: normalizeString(p.subject),
    room: normalizeString(p.room),
    teacher: normalizeString(p.teacher),
    time: normalizeString(p.time)
});
const extractPeriods = (value) => {
    if (!value) return null;
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
        if (Array.isArray(value.periods)) return value.periods;
    }
    return null;
};
const deriveDayCandidate = (fallback, source) => fallback;
const inferWeekType = () => null;

// Logic from route.ts (simplified)
if (fullRes && fullRes.json) {
    const j = fullRes.json;
    const resolveDayKey = (input) => {
        if (!input) return dayNames[requestedDayIndex] || 'Monday';
        // Simplified matching logic
        const raw = String(input).toLowerCase();
        if (raw.includes('mon')) return 'Monday';
        // ...
        return dayNames[requestedDayIndex] || 'Monday';
    };

    // Backfill days that are still empty using the structured `days` object
    if (j.days && typeof j.days === 'object') {
        for (const [rawKey, value] of Object.entries(j.days)) {
            if (!value || typeof value !== 'object') continue;
            const derivedKey = deriveDayCandidate(rawKey, value);
            const periods = extractPeriods(value.periods ? { periods: value.periods } : value);
            if (!periods || !periods.length) continue;
            
            // HERE IS THE ISSUE: resolveDayKey("1") -> "Monday" (default)
            const normalizedKey = resolveDayKey(derivedKey || rawKey);
            
            if (!byDay[normalizedKey]) byDay[normalizedKey] = []; // Should be array
            
            // Append
            const newPeriods = periods.map(entry => toPeriod(entry));
            byDay[normalizedKey] = byDay[normalizedKey].concat(newPeriods);
        }
    }
}

console.log('byDay before backfill:', JSON.stringify(byDay, null, 2));

// Fallback Bells Logic
let bellSchedules = undefined;
const FALLBACK_BELLS = {
    'Mon/Tues': [
        { period: '1', time: '09:00 - 10:05' },
        { period: '2', time: '10:05 - 11:05' }
    ],
    'Wed/Thurs': [],
    'Fri': []
};

if (!bellSchedules) {
    bellSchedules = {};
    for (const bucket of ['Mon/Tues', 'Wed/Thurs', 'Fri']) {
        if (!bellSchedules[bucket] || bellSchedules[bucket].length === 0) {
            bellSchedules[bucket] = FALLBACK_BELLS[bucket];
        }
    }
}

// Backfill Logic
if (bellSchedules) {
    for (const [dayName, periods] of Object.entries(byDay)) {
        let bucket = null;
        if (/^mon|tue/i.test(dayName)) bucket = 'Mon/Tues';
        
        if (bucket && bellSchedules[bucket]) {
            const bells = bellSchedules[bucket];
            for (const p of periods) {
                if (!p.time || !p.time.includes('-')) {
                    const pLabel = String(p.period || '').trim().toLowerCase();
                    const match = bells.find(b => {
                        const bLabel = String(b.period || '').trim().toLowerCase();
                        if (bLabel === pLabel) return true;
                        return false;
                    });
                    if (match && match.time) {
                        p.time = match.time;
                    }
                }
            }
        }
    }
}

console.log('byDay after backfill:', JSON.stringify(byDay, null, 2));

// Filter Logic
for (const dayName of Object.keys(byDay)) {
    byDay[dayName] = byDay[dayName].filter(p => {
        const hasTimeRange = typeof p.time === 'string' && p.time.includes('-');
        return hasTimeRange;
    });
}

console.log('byDay after filter:', JSON.stringify(byDay, null, 2));
