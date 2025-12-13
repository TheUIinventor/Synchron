'use client'

import { useEffect, useState } from 'react'

export default function DebugSubsPage() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portal/substitutions?debug=1', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setData(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="p-8">Loading substitutions...</div>
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Substitutions Debug</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Source</h2>
        <p className="text-sm text-gray-600">{data?.source || 'Unknown'}</p>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Substitutions Count</h2>
        <p className="text-lg">{data?.substitutions?.length || 0} substitutions found</p>
      </div>

      {data?.substitutions && data.substitutions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Substitutions Data</h2>
          <div className="space-y-4">
            {data.substitutions.map((sub: any, idx: number) => (
              <div key={idx} className="border p-4 rounded bg-gray-50">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><strong>Period:</strong> {sub.period || 'N/A'}</div>
                  <div><strong>Subject:</strong> {sub.subject || 'N/A'}</div>
                  <div><strong>Original Teacher:</strong> {sub.originalTeacher || 'N/A'}</div>
                  <div><strong>Substitute:</strong> {sub.substituteTeacher || 'N/A'}</div>
                  <div><strong>Casual Token:</strong> {sub.casual || 'N/A'}</div>
                  <div className="col-span-2">
                    <strong>Casual Surname:</strong> 
                    <span className={sub.casualSurname ? 'text-green-600 font-bold ml-2' : 'text-red-500 ml-2'}>
                      {sub.casualSurname || '❌ MISSING'}
                    </span>
                  </div>
                  <div className="col-span-2"><strong>Full Name:</strong> {sub.substituteTeacherFull || 'N/A'}</div>
                  <div><strong>From Room:</strong> {sub.fromRoom || 'N/A'}</div>
                  <div><strong>To Room:</strong> {sub.toRoom || 'N/A'}</div>
                  {sub.reason && <div className="col-span-2"><strong>Reason:</strong> {sub.reason}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.raw && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-2">Raw API Response</h2>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded overflow-auto text-xs max-h-96">
            {JSON.stringify(data.raw, null, 2)}
          </pre>
        </div>
      )}

      {(!data?.substitutions || data.substitutions.length === 0) && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-yellow-800">
            ⚠️ No substitutions found. This could mean:
          </p>
          <ul className="list-disc ml-6 mt-2 text-sm text-yellow-700">
            <li>You're not logged into the school portal</li>
            <li>There are no substitutes scheduled for today</li>
            <li>The API endpoint is not returning data</li>
          </ul>
        </div>
      )}
    </div>
  )
}
