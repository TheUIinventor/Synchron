'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DebugTimetable2026Page() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [dateInput, setDateInput] = useState('2026-02-02')

  const checkDate = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/debug/timetable-2026?date=${encodeURIComponent(dateInput)}`, {
        credentials: 'include'
      })
      const data = await response.json()
      setResult(data)
    } catch (e: any) {
      setResult({ error: e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4 pb-24">
      <h1 className="text-3xl font-bold mb-4">Debug: 2026 Timetable Data</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Test Date</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="date"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              className="px-3 py-2 border rounded-md flex-1"
            />
            <Button onClick={checkDate} disabled={loading}>
              {loading ? 'Checking...' : 'Check Data'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          {result.error && (
            <Card className="border-red-500">
              <CardContent className="pt-6">
                <p className="text-red-600">Error: {result.error}</p>
              </CardContent>
            </Card>
          )}

          {result.debug && (
            <Card>
              <CardHeader>
                <CardTitle>Debug Info</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-64">
                  {JSON.stringify(result.debug, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {result.summary && (
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p><strong>Student Portal Available:</strong> {result.summary.studentAvailable ? '✓ Yes' : '✗ No'}</p>
                  <p><strong>API Server Available:</strong> {result.summary.apiAvailable ? '✓ Yes' : '✗ No'}</p>
                  <p><strong>Student Portal Has Classes:</strong> {result.summary.studentHasClasses ? '✓ Yes' : '✗ No'}</p>
                  <p><strong>API Server Has Classes:</strong> {result.summary.apiHasClasses ? '✓ Yes' : '✗ No'}</p>
                  <p><strong>Student Year (Portal):</strong> {result.summary.studentYear || 'N/A'}</p>
                  <p><strong>Student Year (API):</strong> {result.summary.apiYear || 'N/A'}</p>
                  <p className="mt-4 p-3 bg-blue-50 rounded"><strong>Recommendation:</strong> {result.summary.recommendation}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {result.results && (
            <Card>
              <CardHeader>
                <CardTitle>Raw API Responses</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {['student.sbhs.net.au', 'api.sbhs.net.au'].map((host) => (
                  <div key={host} className="border rounded p-4">
                    <h4 className="font-semibold mb-2">{host}</h4>
                    <div className="text-xs space-y-1">
                      {result.results[host].error && (
                        <p className="text-red-600">Error: {result.results[host].error}</p>
                      )}
                      {!result.results[host].error && (
                        <>
                          <p><strong>Status:</strong> {result.results[host].status} {result.results[host].statusText}</p>
                          <p><strong>Has Classes:</strong> {result.results[host].hasClasses ? '✓ Yes' : '✗ No'}</p>
                          <p><strong>Student Year:</strong> {result.results[host].studentYear || 'N/A'}</p>
                          <p><strong>Date:</strong> {result.results[host].date}</p>
                          {result.results[host].parseError && (
                            <p className="text-red-600">Parse Error: {result.results[host].parseError}</p>
                          )}
                          {result.results[host].json && (
                            <details className="mt-2">
                              <summary className="cursor-pointer font-semibold">Full Response</summary>
                              <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-64 mt-2">
                                {JSON.stringify(result.results[host].json, null, 2).slice(0, 1000)}
                              </pre>
                            </details>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="mt-8 p-4 bg-amber-50 rounded border border-amber-200">
        <h3 className="font-semibold mb-2">What This Tests:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>Fetches <code className="bg-gray-100 px-1 rounded">daytimetable.json</code> from both SBHS hosts</li>
          <li>Compares responses when authenticated</li>
          <li>Shows which host has actual classes for the date</li>
          <li>Displays student year mapping (critical for accelerants in multiple year levels)</li>
          <li>Helps identify if 2026 data exists on either server</li>
        </ul>
      </div>
    </div>
  )
}
