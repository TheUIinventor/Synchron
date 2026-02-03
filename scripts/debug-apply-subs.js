// Debug script: apply classVariations and roomVariations from provided payload
// and print the resulting Monday (B-week) periods.

const payload = {
	"timetable": {
		"Monday": [ /* omitted for brevity in runtime processing */ ],
		"Tuesday": [],
		"Wednesday": [],
		"Thursday": [],
		"Friday": []
	},
	"timetableByWeek": {
		"Monday": {
			"A": [],
			"B": [
				{
					"period": "1",
					"time": "09:00 - 10:00",
					"subject": "MAT A",
					"teacher": "WARA",
					"fullTeacher": "A Ward",
					"room": "107",
					"weekType": "B"
				},
				{
					"period": "2",
					"time": "10:05 - 11:05",
					"subject": "D&T 1",
					"teacher": "RYAA",
					"fullTeacher": "A Ryan",
					"room": "503",
					"weekType": "B"
				},
				{
					"period": "3",
					"time": "11:25 - 12:25",
					"subject": "HIS B",
					"teacher": "PAUV",
					"fullTeacher": "V Paul",
					"room": "904",
					"weekType": "B"
				},
				{
					"period": "4",
					"time": "12:30 - 13:30",
					"subject": "MUS 1",
					"teacher": "AOUP",
					"fullTeacher": "P Aoun",
					"room": "201",
					"weekType": "B"
				},
				{
					"period": "5",
					"time": "14:10 - 15:10",
					"subject": "CHI A",
					"teacher": "FONR",
					"fullTeacher": "R Fong",
					"room": "213",
					"weekType": "B"
				}
			],
			"unknown": []
		}
	},
	"upstream": {
		"day": {
			"status": "OK",
			"date": "2025-12-15",
			"timetable": { /* omitted */ },
			"roomVariations": {
				"3": {
					"period": "3",
					"year": "8",
					"title": "HIS B",
					"teacher": null,
					"type": "novariation",
					"casual": null,
					"casualSurname": "",
					"roomFrom": "",
					"roomTo": "203"
				}
			},
			"classVariations": {
				"1": {
					"period": "1",
					"year": "8",
					"title": "MAT A",
					"teacher": "WARA",
					"type": "replacement",
					"casual": "LIKV",
					"casualSurname": "V Likourezos",
					"roomFrom": "",
					"roomTo": null
				},
				"RC": {
					"period": "RC",
					"year": "0",
					"title": "RC 8E",
					"teacher": "CURJ",
					"type": "novariation",
					"casual": "",
					"casualSurname": "",
					"roomFrom": "",
					"roomTo": null
				}
			},
			"serverTimezone": "39600",
			"shouldDisplayVariations": true
		}
	}
}

function clone(obj) { return JSON.parse(JSON.stringify(obj)) }

const mondayB = (payload.timetableByWeek && payload.timetableByWeek.Monday && payload.timetableByWeek.Monday.B) ? clone(payload.timetableByWeek.Monday.B) : []

const classVars = (payload.upstream && payload.upstream.day && payload.upstream.day.classVariations) || {}
const roomVars = (payload.upstream && payload.upstream.day && payload.upstream.day.roomVariations) || {}

const normalize = (s) => (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '').trim()

console.log('Before processing Monday (B-week):')
console.log(JSON.stringify(mondayB, null, 2))

// Apply class variations
Object.keys(classVars).forEach((k) => {
	const v = classVars[k]
	if (!v) return
	const targetPeriod = String(v.period || k)
	const casualSurname = v.casualSurname ? String(v.casualSurname).trim() : ''
	const casualToken = v.casual ? String(v.casual).trim() : ''

	for (let per of mondayB) {
		if (normalize(per.period) === normalize(targetPeriod)) {
			// Apply only when casualSurname present (replacement)
			if (casualSurname.length > 0) {
				per.originalTeacher = per.teacher || per.originalTeacher
				per.casualSurname = casualSurname
				per.casualToken = casualToken || undefined
				per.displayTeacher = casualSurname
				per.fullTeacher = casualSurname
				per.teacher = casualSurname
				per.isSubstitute = true
			}
		}
	}
})

// Apply room variations
Object.keys(roomVars).forEach((k) => {
	const v = roomVars[k]
	if (!v) return
	const targetPeriod = String(v.period || k)
	const roomTo = v.roomTo ? String(v.roomTo).trim() : ''
	if (!roomTo) return

	for (let per of mondayB) {
		if (normalize(per.period) === normalize(targetPeriod)) {
			if ((per.room || '').toString().trim().toLowerCase() !== roomTo.toLowerCase()) {
				per.displayRoom = roomTo
				per.isRoomChange = true
			}
		}
	}
})

console.log('\nAfter applying variations (Monday B-week):')
console.log(JSON.stringify(mondayB, null, 2))

// Print a concise summary for the user
console.log('\nSummary:')
mondayB.forEach((p) => {
	const room = p.displayRoom || p.room || ''
	const teacher = p.displayTeacher || p.fullTeacher || p.teacher || ''
	const sub = p.isSubstitute ? ' (SUB)' : ''
	console.log(`Period ${p.period}: ${p.subject} — teacher: ${teacher}${sub} — room: ${room}`)
})
