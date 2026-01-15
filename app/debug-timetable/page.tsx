'use client'

import { useEffect, useState } from 'react'

export default function DebugTimetablePage() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/timetable', { credentials: 'include' })
      .then(async res => {
        const contentType = res.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          return res.json()
        } else {
          const text = await res.text()
          throw new Error(`API returned ${contentType} instead of JSON`)
        }
      })
      .then(data => {
        setData(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="p-8">Loading timetable...</div>
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>

  const mondayPeriods = data?.timetable?.Monday || data?.timetableByWeek?.Monday?.A || data?.timetableByWeek?.Monday?.B || []
  const upstream = data?.upstream
  const classVariations = upstream?.day?.classVariations || upstream?.classVariations || {}
  const roomVariations = upstream?.day?.roomVariations || upstream?.roomVariations || {}

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Timetable Debug</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Monday Periods</h2>
        <p className="text-sm text-gray-600 mb-4">{mondayPeriods.length} periods found</p>
        <div className="space-y-2">
          {mondayPeriods.slice(0, 10).map((p: any, idx: number) => (
            <div key={idx} className="border p-3 rounded bg-gray-50 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <div><strong>Period:</strong> {p.period}</div>
                <div><strong>Subject:</strong> {p.subject}</div>
                <div><strong>Teacher:</strong> {p.teacher}</div>
                <div><strong>Full Teacher:</strong> {p.fullTeacher || 'N/A'}</div>
                <div><strong>Display Teacher:</strong> {p.displayTeacher || 'N/A'}</div>
                <div><strong>Original Teacher:</strong> {p.originalTeacher || 'N/A'}</div>
                <div className="col-span-3">
                  <strong>Casual Surname:</strong> 
                  <span className={p.casualSurname ? 'text-green-600 font-bold ml-2' : 'text-gray-400 ml-2'}>
                    {p.casualSurname || 'None'}
                  </span>
                </div>
                <div><strong>Is Substitute:</strong> {p.isSubstitute ? '✅ Yes' : '❌ No'}</div>
                <div><strong>Room:</strong> {p.room || 'N/A'}</div>
                <div><strong>Display Room:</strong> {p.displayRoom || 'N/A'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Upstream Class Variations</h2>
        <p className="text-sm text-gray-600 mb-4">{Object.keys(classVariations).length} variations found</p>
        {Object.keys(classVariations).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(classVariations).map(([key, v]: [string, any]) => (
              <div key={key} className="border p-3 rounded bg-blue-50 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><strong>Period:</strong> {v.period || key}</div>
                  <div><strong>Subject:</strong> {v.title || v.subject}</div>
                  <div><strong>Teacher:</strong> {v.teacher}</div>
                  <div><strong>Type:</strong> {v.type}</div>
                  <div><strong>Casual:</strong> {v.casual || 'N/A'}</div>
                  <div className="col-span-2">
                    <strong>Casual Surname:</strong> 
                    <span className={v.casualSurname ? 'text-green-600 font-bold ml-2' : 'text-red-500 ml-2'}>
                      {v.casualSurname || '❌ MISSING'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-yellow-600">⚠️ No class variations found in upstream data</p>
        )}
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Upstream Room Variations</h2>
        <p className="text-sm text-gray-600 mb-4">{Object.keys(roomVariations).length} variations found</p>
        {Object.keys(roomVariations).length > 0 && (
          <div className="space-y-2">
            {Object.entries(roomVariations).slice(0, 5).map(([key, v]: [string, any]) => (
              <div key={key} className="border p-3 rounded bg-green-50 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <div><strong>Period:</strong> {v.period || key}</div>
                  <div><strong>From:</strong> {v.roomFrom}</div>
                  <div><strong>To:</strong> {v.roomTo}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Full Upstream Object</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded overflow-auto text-xs max-h-96">
          {JSON.stringify(upstream, null, 2)}
        </pre>
      </div>
    </div>
  )
}
