'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DebugDayTimetablePage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [dateInput, setDateInput] = useState('2026-02-02')
  const [host, setHost] = useState('student.sbhs.net.au')

  const fetchDayTimetable = async () => {
    setLoading(true)
    try {
      // Directly fetch from the SBHS server via our proxy
      const proxyUrl = `/api/timetable?date=${encodeURIComponent(dateInput)}`
      const response = await fetch(proxyUrl, {
        credentials: 'include'
      })
      const contentType = response.headers.get('content-type') || ''
      let data: any
      
      if (contentType.includes('application/json')) {
        data = await response.json()
      } else {
        const text = await response.text()
        data = { error: `Non-JSON response (${response.status}): ${text.substring(0, 500)}` }
      }
      
      setResult({
        status: response.status,
        contentType,
        data,
        url: proxyUrl,
        date: dateInput,
        timestamp: new Date().toISOString()
      })
    } catch (e: any) {
      setResult({ error: e.message })
    } finally {
      setLoading(false)
    }
  }

  const fetchRawDayTimetable = async (selectedHost: string) => {
    setLoading(true)
    try {
      // This endpoint should tell us what raw daytimetable.json looks like from each host
      const response = await fetch(`/api/debug/daytimetable-raw?date=${encodeURIComponent(dateInput)}&host=${encodeURIComponent(selectedHost)}`, {
        credentials: 'include'
      })
      const data = await response.json()
      setResult({
        status: response.status,
        data,
        url: `/api/debug/daytimetable-raw?date=${dateInput}&host=${selectedHost}`,
        host: selectedHost,
        date: dateInput,
        timestamp: new Date().toISOString()
      })
    } catch (e: any) {
      setResult({ error: e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4 pb-24">
      <h1 className="text-3xl font-bold mb-4">Debug: daytimetable.json</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Fetch Raw Response</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="px-3 py-2 border rounded-md"
              />
              <select
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="student.sbhs.net.au">student.sbhs.net.au</option>
                <option value="api.sbhs.net.au">api.sbhs.net.au</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => fetchRawDayTimetable(host)} 
                disabled={loading}
              >
                {loading ? 'Fetching...' : 'Fetch Raw daytimetable.json'}
              </Button>
              <Button 
                onClick={fetchDayTimetable} 
                disabled={loading}
                variant="outline"
              >
                {loading ? 'Fetching...' : 'Fetch via /api/timetable'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          {result.error && (
            <Card className="border-red-500">
              <CardContent className="pt-6">
                <p className="text-red-600 font-mono text-sm">{result.error}</p>
              </CardContent>
            </Card>
          )}

          {!result.error && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Response Metadata</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p><strong>URL:</strong> <code className="bg-gray-100 px-2 py-1 rounded text-xs">{result.url}</code></p>
                  <p><strong>Status:</strong> {result.status}</p>
                  <p><strong>Date:</strong> {result.date}</p>
                  {result.host && <p><strong>Host:</strong> {result.host}</p>}
                  <p><strong>Fetched:</strong> {result.timestamp}</p>
                  {result.contentType && <p><strong>Content-Type:</strong> {result.contentType}</p>}
                </CardContent>
              </Card>

              {result.data && (
                <Card>
                  <CardHeader>
                    <CardTitle>Full Response</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-auto max-h-96 bg-gray-50 p-4 rounded border border-gray-200">
                      <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              )}

              {result.data?.timetable && (
                <Card>
                  <CardHeader>
                    <CardTitle>Timetable Structure</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <p><strong>Status:</strong> {result.data.status || 'N/A'}</p>
                    <p><strong>Date:</strong> {result.data.date || 'N/A'}</p>
                    <p><strong>Bells:</strong> {Array.isArray(result.data.bells) ? result.data.bells.length : 'N/A'}</p>
                    {result.data.timetable && (
                      <>
                        <p><strong>timetable.timetable.periods:</strong> {Object.keys(result.data.timetable?.timetable?.periods || {}).length} periods</p>
                        <p><strong>Period keys:</strong> {Object.keys(result.data.timetable?.timetable?.periods || {}).join(', ')}</p>
                        <p><strong>Subjects:</strong> {Object.keys(result.data.timetable?.subjects || {}).join(', ')}</p>
                      </>
                    )}
                    {result.data.classVariations && <p><strong>Has classVariations:</strong> {Object.keys(result.data.classVariations).length} entries</p>}
                    {result.data.roomVariations && <p><strong>Has roomVariations:</strong> {Object.keys(result.data.roomVariations).length} entries</p>}
                  </CardContent>
                </Card>
              )}

              {result.data?.timetable?.timetable?.periods && (
                <Card>
                  <CardHeader>
                    <CardTitle>Sample Period Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 max-h-96 overflow-auto">
                      {Object.entries(result.data.timetable.timetable.periods).slice(0, 5).map(([periodKey, period]: [string, any]) => (
                        <div key={periodKey} className="border-l-4 border-primary pl-4 py-2">
                          <p className="font-semibold text-sm">{periodKey}</p>
                          <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-auto">
                            {JSON.stringify(period, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 rounded border border-blue-200">
        <h3 className="font-semibold mb-2">What This Shows:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li><strong>Raw daytimetable.json:</strong> Shows the exact response from SBHS server for the selected date and host</li>
          <li><strong>Via /api/timetable:</strong> Shows what our API route processes and returns</li>
          <li>Check the <strong>timetable.timetable.periods</strong> count - should be > 0 for school days</li>
          <li>Look for <strong>classVariations</strong> and <strong>roomVariations</strong> data</li>
          <li>Compare the two buttons to see if there's a difference in processing</li>
        </ul>
      </div>
    </div>
  )
}
