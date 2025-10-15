"use client";

import { useEffect, useState } from "react";

export default function NoticesClient() {
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>("All");

  useEffect(() => {
    async function fetchNotices() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/notices");
        if (!response.ok) throw new Error("Failed to fetch notices");
        const data = await response.json();
        if (Array.isArray(data)) {
          setNotices(data);
        } else if (Array.isArray(data.notices)) {
          setNotices(data.notices);
        } else if (Array.isArray(data.news)) {
          setNotices(data.news);
        } else {
          setNotices([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchNotices();
  }, []);

  // Extract unique years from notices
  const years = Array.from(new Set(notices.flatMap(n => n.year ? [n.year] : [])));
  years.sort();

  // Filter notices by year
  const filteredNotices = selectedYear === "All"
    ? notices
    : notices.filter(n => n.year === selectedYear);

  return (
    <main className="min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Daily Notices</h1>
      <div className="mb-4">
        <label htmlFor="year-filter" className="mr-2 font-medium">Filter by Year:</label>
        <select
          id="year-filter"
          value={selectedYear}
          onChange={e => setSelectedYear(e.target.value)}
          className="border rounded px-2 py-1"
        >
          <option value="All">All</option>
          {years.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>
      {loading ? (
        <p>Loading notices...</p>
      ) : error ? (
        <p className="text-red-500">Error: {error}</p>
      ) : filteredNotices.length > 0 ? (
        <ul className="space-y-3">
          {filteredNotices.map((notice, idx) => (
            <li key={idx} className="p-4 rounded bg-gray-100 dark:bg-gray-800">
              <div className="font-semibold text-lg mb-1">{notice.title || notice.type}</div>
              <div className="text-sm text-gray-600 mb-2">{notice.text || notice.details || notice.message}</div>
              {/* Show all other fields for debugging/visibility */}
              <pre className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-900 rounded p-2 overflow-x-auto">
                {JSON.stringify(notice, null, 2)}
              </pre>
              <div className="text-xs text-gray-400 mt-1">{notice.date || notice.day || notice.time || ""}</div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-gray-500">No Notices Available At This Time</p>
      )}
    </main>
  );
}
}
