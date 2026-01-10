
const dateParam = "2025-12-25"; // Thursday
const requestedDayIndex = new Date(dateParam).getDay(); // 4 (Thursday)
const requestedWeekdayString = "Thursday";

// Mock Responses
const dayRes = {
    json: {
        date: "2026-01-02", // Mismatch
        bells: [],
        timetable: { periods: {} }
    }
};

const bellsRes = {
    json: {
        date: "2026-01-02", // Mismatch
        bells: [
            { period: "1", startTime: "09:00", endTime: "10:00" } // Friday bells
        ]
    }
};

const fullRes = {
    json: {
        days: {
            Thursday: [
                { period: "1", subject: "Maths", room: "101", weekType: "A" },
                { period: "2", subject: "English", room: "102", weekType: "A" }
            ]
        }
    }
};

// --- Logic from route.ts ---

async function run() {
    let bellSchedules = undefined;
    let bellTimesSources = undefined;
    const byDay = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] };

    // 1. Date Mismatch Check (Day)
    let shouldProcessDayRes = true;
    const dj = dayRes.json;
    const upstreamDate = dj.date;
    if (upstreamDate && String(upstreamDate).slice(0, 10) !== String(dateParam).slice(0, 10)) {
        console.log("Day mismatch detected. Discarding dayRes.");
        shouldProcessDayRes = false;
    }

    // 2. Date Mismatch Check (Bells) - MY FIX
    let processedBellsRes = bellsRes;
    if (processedBellsRes && processedBellsRes.json) {
        const bj = processedBellsRes.json;
        const upstreamDateBells = bj.date;
        if (upstreamDateBells && String(upstreamDateBells).slice(0, 10) !== String(dateParam).slice(0, 10)) {
            console.log("Bells mismatch detected. Discarding bellsRes.");
            processedBellsRes = null;
        }
    }

    // 3. Process Full Res (Cycle)
    if (fullRes && fullRes.json) {
        const j = fullRes.json;
        const days = j.days;
        for (const [day, periods] of Object.entries(days)) {
            if (byDay[day]) {
                byDay[day] = periods.map(p => ({ ...p, time: "" })); // Simulate missing time
            }
        }
    }

    // 4. Build Bell Schedules
    // Mocking buildBellSchedulesFromResponses
    const buildBellSchedulesFromResponses = (dr, fr, br) => {
        const schedules = { 'Mon/Tues': [], 'Wed/Thurs': [], Fri: [] };
        // If br is null, we get nothing from it.
        // If fr has no bells, we get nothing.
        return { schedules, sources: {} };
    };

    if (!bellSchedules) {
        const { schedules, sources } = buildBellSchedulesFromResponses(shouldProcessDayRes ? dayRes : null, fullRes, processedBellsRes);
        bellSchedules = schedules;
        bellTimesSources = sources;
    }

    // 5. Fallback Bells - MY FIX
    const FALLBACK_BELLS = {
        'Mon/Tues': [{ period: '1', time: '09:00 - 10:05' }],
        'Wed/Thurs': [{ period: '1', time: '09:00 - 10:00' }, { period: '2', time: '10:05 - 11:05' }],
        'Fri': [{ period: '1', time: '09:00 - 10:05' }]
    };

    if (bellSchedules) {
        for (const bucket of ['Mon/Tues', 'Wed/Thurs', 'Fri']) {
            if (!bellSchedules[bucket] || bellSchedules[bucket].length === 0) {
                console.log(`Backfilling bucket ${bucket}`);
                bellSchedules[bucket] = FALLBACK_BELLS[bucket];
            }
        }
    }

    // 6. Backfill Times
    if (bellSchedules) {
        for (const [dayName, periods] of Object.entries(byDay)) {
            let bucket = null;
            if (/^mon|tue/i.test(dayName)) bucket = 'Mon/Tues';
            else if (/^wed|thu/i.test(dayName)) bucket = 'Wed/Thurs';
            else if (/^fri/i.test(dayName)) bucket = 'Fri';

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

    // 7. Filter
    for (const dayName of Object.keys(byDay)) {
        byDay[dayName] = byDay[dayName].filter(p => {
            const hasTimeRange = typeof p.time === 'string' && p.time.includes('-');
            return hasTimeRange;
        });
    }

    console.log("Result for Thursday:", JSON.stringify(byDay.Thursday, null, 2));
}

run();
