'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DebugEndpointScanPage() {
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [dateInput, setDateInput] = useState('2026-02-02')

  const scanAllEndpoints = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/debug/scan-endpoints?date=${encodeURIComponent(dateInput)}`, {
        credentials: 'include'
      })
      const data = await response.json()
      setResults(data)
    } catch (e: any) {
      setResults({ error: e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4 pb-24">
      <h1 className="text-3xl font-bold mb-4">Debug: Scan All Endpoints</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Test Date</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap items-end">
              <div className="flex flex-col">
                <label className="text-sm font-medium mb-1">Date to Test</label>
                <input
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className="px-3 py-2 border rounded-md"
                />
              </div>
              <Button 
                onClick={scanAllEndpoints} 
                disabled={loading}
              >
                {loading ? 'Scanning...' : 'Scan All Endpoints'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {results && (
        <div className="space-y-4">
          {results.error && (
            <Card className="border-red-500">
              <CardContent className="pt-6">
                <p className="text-red-600">{results.error}</p>
              </CardContent>
            </Card>
          )}

          {results.summary && (
            <Card className="border-blue-500 bg-blue-50">
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><strong>Date Tested:</strong> {results.summary.dateRequested}</p>
                <p><strong>Endpoints with Data:</strong> {results.summary.endpointsWithData}</p>
                <p><strong>Endpoints with 2026 Year:</strong> {results.summary.has2026Year}</p>
              </CardContent>
            </Card>
          )}

          {results.endpoints && (
            <Card>
              <CardHeader>
                <CardTitle>Endpoint Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-auto">
                  {results.endpoints.map((ep: any) => (
                    <div key={ep.endpoint} className={`border-l-4 pl-4 py-2 ${ep.periodCount > 0 ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-sm">{ep.endpoint}</p>
                        <span className={`text-xs px-2 py-1 rounded ${ep.status === 200 ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                          {ep.status}
                        </span>
                      </div>
                      <div className="text-xs space-y-1 text-gray-700">
                        <p><strong>Periods:</strong> {ep.periodCount}</p>
                        <p><strong>Year:</strong> {ep.year || 'N/A'}</p>
                        <p><strong>URL:</strong> <code className="bg-gray-100 px-1 rounded text-xs">{ep.url}</code></p>
                        {ep.error && <p className="text-red-600"><strong>Error:</strong> {ep.error}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {results.raw && (
            <Card>
              <CardHeader>
                <CardTitle>Raw Response (First Endpoint with Data)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto max-h-96 bg-gray-50 p-4 rounded border">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                    {JSON.stringify(results.raw, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 rounded border border-blue-200">
        <h3 className="font-semibold mb-2">Endpoints Tested:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm font-mono">
          <li>student.sbhs.net.au /api/timetable/daytimetable.json</li>
          <li>api.sbhs.net.au /api/timetable/daytimetable.json</li>
          <li>student.sbhs.net.au /api/timetable/timetable.json</li>
          <li>api.sbhs.net.au /api/timetable/timetable.json</li>
          <li>student.sbhs.net.au /api/students/timetable</li>
          <li>api.sbhs.net.au /api/students/timetable</li>
          <li>student.sbhs.net.au /api/timetable/year/{year}/timetable.json</li>
          <li>And more variants...</li>
        </ul>
      </div>
    </div>
  )
}
