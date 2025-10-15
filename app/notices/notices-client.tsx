"use client";
import { useEffect, useState } from "react";
import InstallAppButton from "@/components/install-app-button";

const yearColors: Record<string, string> = {
  "7": "bg-blue-100 text-blue-700",
  "8": "bg-green-100 text-green-700",
  "9": "bg-yellow-100 text-yellow-700",
  "10": "bg-purple-100 text-purple-700",
  "11": "bg-pink-100 text-pink-700",
  "12": "bg-red-100 text-red-700",
};

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
        let data = null;
        if (typeof window !== "undefined") {
          const cached = sessionStorage.getItem("notices-data");
          if (cached) {
            data = JSON.parse(cached);
          }
        if (!data) {
          const response = await fetch("/api/notices");
          if (!response.ok) throw new Error("Failed to fetch notices");
          data = await response.json();
        }
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

  const fixedYears = [
    "All",
    "Year 7",
    "Year 8",
    "Year 9",
    "Year 10",
    "Year 11",
    "Year 12",
    "Staff"
  ];

  function expandYearTags(displayYears: string) {
    const tags = displayYears.split(',').map((y: string) => y.trim());
    let expanded: string[] = [];
    tags.forEach(tag => {
      // Match 'Years 8-11' or 'Year 8-11'
      const rangeMatch = tag.match(/^Years? (\d+)-(\d+)$/i);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        for (let y = start; y <= end; y++) {
          expanded.push(`Year ${y}`);
        }
        return;
      }
      // Match 'Year 8'
      const singleMatch = tag.match(/^Year (\d+)$/i);
      if (singleMatch) {
        expanded.push(`Year ${singleMatch[1]}`);
        return;
      }
      // Pass through Staff, All Students and Staff, etc.
      expanded.push(tag);
    });
    return expanded;
  }

  const filteredNotices = selectedYear === "All"
    ? notices
    : notices.filter(n => {
        if (!n.displayYears) return false;
        const tags = expandYearTags(n.displayYears);
        if (tags.includes(selectedYear)) return true;
        if (tags.some((t: string) => t.toLowerCase() === 'all students and staff')) return true;
        if (tags.includes('Staff') && selectedYear === 'Staff') return true;
        return false;
      });

  return (
    <main className="notices-main min-h-screen flex flex-col items-center w-full" style={{ transform: 'scale(0.8)', transformOrigin: 'top left' }}>
      <div className="mb-6 flex gap-2 items-center">
        <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-full p-1 flex-wrap">
          <button
            className={`px-4 py-1 rounded-full text-sm font-medium transition-colors duration-150 ${selectedYear === "All" ? "bg-blue-600 text-white shadow" : "text-gray-700 dark:text-gray-200"}`}
            onClick={() => setSelectedYear("All")}
          >
            All
          </button>
          {fixedYears.slice(1).map((year: string) => (
            <button
              key={year}
              className={`ml-1 px-4 py-1 rounded-full text-sm font-medium transition-colors duration-150 ${selectedYear === year ? "bg-blue-600 text-white shadow" : (yearColors[year.replace(/\D/g,"")] || "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200")}`}
              onClick={() => setSelectedYear(year)}
            >
              {year}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <p>Loading notices...</p>
      ) : error ? (
        <p className="text-red-500">Error: {error}</p>
      ) : filteredNotices.length > 0 ? (
        <div>
          <ul className="space-y-6 w-full max-w-2xl mx-auto px-2 sm:px-0">
            {filteredNotices.map((notice, idx) => (
              <li key={idx} className="notices-card rounded-2xl bg-white dark:bg-gray-900 shadow-lg p-4 sm:p-8 flex flex-col gap-2 w-full border border-gray-100 dark:border-gray-800 transition-all">
                <div className="text-2xl font-bold mb-1">{notice.title || notice.type}</div>
                <div className="text-lg text-gray-700 dark:text-gray-200 mb-2"
                  dangerouslySetInnerHTML={{
                    __html: (() => {
                      let msg = notice.text || notice.details || notice.content || notice.message || "";
                      msg = msg.replace(/^<p>/i, '').replace(/<\/p>$/i, '').trim();
                      return msg;
                    })()
                  }}
                />
                <div className="flex items-center gap-3 mt-2">
                  {notice.authorName && (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-lg" style={{ background: '#06b6d4' }}>
                      {notice.authorName.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                    </div>
                  )}
                  {notice.authorName && (
                    <span className="font-semibold text-lg">{notice.authorName}</span>
                  )}
                  {notice.displayYears && (
                    <span
                      className="ml-2 px-3 py-1 rounded-full text-xs font-medium"
                      style={{
                        background: 'var(--theme-primary-bg, #dbeafe)',
                        color: 'var(--theme-primary-fg, #2563eb)'
                      }}
                    >
                      {notice.displayYears}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="w-full flex justify-center mt-10">
            <InstallAppButton />
          </div>
        </div>
      ) : (
        <p className="text-center text-gray-500">No Notices Available At This Time</p>
      )}
    </main>
  );
}