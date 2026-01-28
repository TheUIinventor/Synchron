'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DebugDateScanPage() {
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState('2026-02-02')
  const [endDate, setEndDate] = useState('2026-02-28')

  const scanDateRange = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/debug/scan-dates?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`, {
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
    <div className="container max-w-4xl mx-auto py-8 px-4 pb-24">
      <h1 className="text-3xl font-bold mb-4">Debug: Scan for 2026 Data</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Scan Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <div className="flex flex-col">
                <label className="text-sm font-medium mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border rounded-md"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border rounded-md"
                />
              </div>
            </div>
            <Button 
              onClick={scanDateRange} 
              disabled={loading}
            >
              {loading ? 'Scanning...' : 'Scan Dates'}
            </Button>
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
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><strong>Dates Scanned:</strong> {results.summary.totalDates}</p>
                <p><strong>Portal Dates with 2026 Data:</strong> {results.summary.portal2026Count}</p>
                <p><strong>API Dates with 2026 Data:</strong> {results.summary.api2026Count}</p>
                <p><strong>Portal Dates with 2025 Data:</strong> {results.summary.portal2025Count}</p>
                <p><strong>API Dates with 2025 Data:</strong> {results.summary.api2025Count}</p>
              </CardContent>
            </Card>
          )}

          {results.results && (
            <Card>
              <CardHeader>
                <CardTitle>Detailed Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto max-h-96">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left">Date</th>
                        <th className="px-2 py-1 text-left">Portal Status</th>
                        <th className="px-2 py-1 text-left">Portal Year</th>
                        <th className="px-2 py-1 text-left">Portal Periods</th>
                        <th className="px-2 py-1 text-left">API Status</th>
                        <th className="px-2 py-1 text-left">API Year</th>
                        <th className="px-2 py-1 text-left">API Periods</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.results.map((row: any) => (
                        <tr key={row.date} className="border-b hover:bg-gray-50">
                          <td className="px-2 py-1">{row.date}</td>
                          <td className="px-2 py-1">{row.portalStatus}</td>
                          <td className="px-2 py-1">{row.portalYear || '-'}</td>
                          <td className="px-2 py-1">{row.portalPeriods}</td>
                          <td className="px-2 py-1">{row.apiStatus}</td>
                          <td className="px-2 py-1">{row.apiYear || '-'}</td>
                          <td className="px-2 py-1">{row.apiPeriods}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 rounded border border-blue-200">
        <h3 className="font-semibold mb-2">What This Does:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>Scans a date range (default Feb 2-28, 2026) to find which dates have 2026 data</li>
          <li>Checks both student.sbhs.net.au and api.sbhs.net.au</li>
          <li>Shows the student year extracted from each response</li>
          <li>Shows period count for each date</li>
          <li>Helps identify when SBHS has actually published 2026 timetables</li>
        </ul>
      </div>
    </div>
  )
}
