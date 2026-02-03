"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export default function DebugCalendarPage() {
  const [dateInput, setDateInput] = useState(() => {
    const today = new Date()
    return today.toISOString().slice(0, 10)
  })
  const [response, setResponse] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFetch = async () => {
    setLoading(true)
    setError(null)
    setResponse(null)
    try {
      const res = await fetch(`/api/calendar?endpoint=days&from=${encodeURIComponent(dateInput)}&to=${encodeURIComponent(dateInput)}`, { credentials: 'include' })
      const data = await res.json()
      setResponse(data)
      if (!res.ok) {
        setError(`API Error: ${res.status} ${res.statusText}`)
      }
    } catch (e) {
      setError(`Network error: ${String(e)}`)
    } finally {
      setLoading(false)
    }
  }
// Render UI
  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-on-surface mb-6">Calendar API Debug</h1>
        
        <Card className="p-6 mb-6 bg-surface-container">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">Date (YYYY-MM-DD):</label>
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="w-full px-3 py-2 border border-outline rounded-md bg-surface text-on-surface"
              />
            </div>
            
            <Button
              onClick={handleFetch}
              disabled={loading}
              className="w-full"
            >
              {loading ? "Loading..." : "Fetch Calendar Data"}
            </Button>
          </div>
        </Card>

        {error && (
          <Card className="p-4 mb-6 bg-red-100 border-red-300">
            <p className="text-red-900 font-semibold">Error:</p>
            <p className="text-red-800 text-sm mt-2">{error}</p>
          </Card>
        )}

        {response && (
          <Card className="p-6 bg-surface-container">
            <h2 className="text-lg font-semibold text-on-surface mb-4">Response:</h2>
            <div className="bg-surface p-4 rounded border border-outline overflow-auto max-h-96">
              <pre className="text-xs text-on-surface-variant whitespace-pre-wrap break-words">
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
            
            {response && response[dateInput] && (
              <div className="mt-6 p-4 bg-green-100 border border-green-300 rounded">
                <h3 className="font-semibold text-green-900 mb-2">Extracted Values:</h3>
                <div className="text-sm text-green-800 space-y-1">
                  <p><strong>Week:</strong> {response[dateInput].week || "N/A"}</p>
                  <p><strong>Week Type:</strong> {response[dateInput].weekType || "N/A"}</p>
                  <p><strong>Term:</strong> {response[dateInput].term || "N/A"}</p>
                  <p><strong>Day Number:</strong> {response[dateInput].dayNumber || "N/A"}</p>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
