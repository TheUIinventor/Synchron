"use client";

import { useEffect, useState } from "react";

export default function NoticesClient() {
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNotices() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/notices");
        if (!response.ok) throw new Error("Failed to fetch notices");
        const data = await response.json();
        // SBHS API returns an array or an object with a property like 'notices' or 'news'.
        // Try to find the correct property, fallback to data if it's an array.
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

  return (
    <main className="min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Daily Notices</h1>
      {loading ? (
        <p>Loading notices...</p>
      ) : error ? (
        <p className="text-red-500">Error: {error}</p>
      ) : notices.length > 0 ? (
        <ul className="space-y-3">
          {notices.map((notice, idx) => (
            <li key={idx} className="p-4 rounded bg-gray-100 dark:bg-gray-800">
              <div className="font-semibold">{notice.title || notice.type}</div>
              <div className="text-sm text-gray-600">{notice.text || notice.details}</div>
              <div className="text-xs text-gray-400 mt-1">{notice.date}</div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-gray-500">No Notices Available At This Time</p>
      )}
    </main>
  );
}
