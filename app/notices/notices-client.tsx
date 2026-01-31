"use client";
import { useEffect, useState, useRef } from "react";
import InstallAppButton from "@/components/install-app-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Filter, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";

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
        // Treat 'All' or 'All Students and Staff' as visible to everyone
        if (tags.some((t: string) => ['all', 'all students and staff', 'all students & staff'].includes(t.toLowerCase()))) return true;
        // Treat 'All Students' as visible to student years (Year 7-12) but not Staff
        const hasAllStudentsTag = tags.some((t: string) => t.toLowerCase() === 'all students');
        if (hasAllStudentsTag && selectedYear.startsWith('Year ')) return true;
        if (tags.includes('Staff') && selectedYear === 'Staff') return true;
        return false;
      });

  return (
    <main className="notices-main min-h-screen flex flex-col items-center w-full pb-24">
      <div className="w-full max-w-3xl space-y-6">
        
        {/* Header & Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between sticky top-0 z-10 bg-background/80 backdrop-blur-md py-4 px-2">
          <h1 className="text-3xl font-semibold hidden md:block">Notices</h1>
          
          {/* Mobile Filter */}
          <div className="w-full md:hidden">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-full rounded-full bg-surface-container-high border-none h-12 px-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 opacity-50" />
                  <SelectValue placeholder="Filter by Year" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {fixedYears.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Desktop Filter */}
          <div className="hidden md:flex gap-2 overflow-x-auto pb-2 max-w-full no-scrollbar">
            {fixedYears.map((year) => (
              <Button
                key={year}
                variant={selectedYear === year ? "default" : "outline"}
                onClick={() => setSelectedYear(year)}
                className={cn(
                  "rounded-full px-6 transition-all",
                  selectedYear === year ? "shadow-md" : "border-outline hover:bg-surface-variant"
                )}
              >
                {year}
              </Button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground animate-pulse">Fetching notices...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-destructive">
            <AlertCircle className="h-10 w-10" />
            <p>Error: {error}</p>
          </div>
        ) : filteredNotices.length > 0 ? (
          <div className="space-y-4 px-2 md:px-0">
            {filteredNotices.map((notice, idx) => (
              <Card key={idx} className="overflow-hidden border-none shadow-elevation-1 hover:shadow-elevation-2 transition-all duration-300 bg-surface-container-low">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start gap-4">
                    <CardTitle className="text-xl font-bold leading-tight">
                      {notice.title || notice.type}
                    </CardTitle>
                    {notice.displayYears && (
                      <Badge variant="secondary" className="shrink-0 bg-primary/10 text-primary hover:bg-primary/20">
                        {notice.displayYears}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <NoticeCard notice={notice} idx={idx} />

                  {notice.authorName && (
                    <div className="mt-4 flex items-center gap-3 pt-4 border-t border-outline-variant/50">
                      <div className="h-8 w-8 rounded-full bg-tertiary/20 text-tertiary-foreground flex items-center justify-center text-xs font-bold">
                        {notice.authorName.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                      </div>
                      <span className="text-sm font-medium opacity-80">{notice.authorName}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            
            <div className="flex justify-center pt-8 pb-4">
              <InstallAppButton />
            </div>
          </div>
        ) : (
          <div className="py-16 text-center">
            <Utensils className="h-12 w-12 mx-auto mb-4 text-primary/40" />
            <h3 className="text-xl font-bold text-on-surface mb-2">No notices available</h3>
            <p className="text-on-surface-variant">Nothing to see here for {selectedYear}</p>
          </div>
        )}
      </div>
    </main>
  );
}

// Small helper component to render a notice with a collapsed one-line preview
function NoticeCard({ notice, idx }: { notice: any, idx: number }) {
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => {
      try {
        // Apply the same collapsed style temporarily to measure
        const prevDisplay = el.style.display
        const prevWebkitBoxOrient = (el.style as any).WebkitBoxOrient
        const prevWebkitLineClamp = (el.style as any).WebkitLineClamp
        el.style.display = '-webkit-box'
        ;(el.style as any).WebkitBoxOrient = 'vertical'
        ;(el.style as any).WebkitLineClamp = '1'
        // If the scrollHeight is greater than clientHeight we have overflow
        const isOverflow = el.scrollHeight > el.clientHeight + 1
        setOverflowing(isOverflow)
        // Restore
        el.style.display = prevDisplay
        ;(el.style as any).WebkitBoxOrient = prevWebkitBoxOrient
        ;(el.style as any).WebkitLineClamp = prevWebkitLineClamp
      } catch (e) {
        // ignore
      }
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [notice])

  const raw = (notice.text || notice.details || notice.content || notice.message || "").replace(/^<p>/i, '').replace(/<\/p>$/i, '').trim()

  const collapsedStyle: any = {
    display: '-webkit-box',
    WebkitLineClamp: 1 as any,
    WebkitBoxOrient: 'vertical' as any,
    overflow: 'hidden'
  }

  return (
    <div>
      <div
        ref={ref}
        className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground"
        style={!expanded ? collapsedStyle : undefined}
        dangerouslySetInnerHTML={{ __html: raw }}
        aria-expanded={expanded}
      />

      {overflowing && (
        <div className="mt-2">
          <Button variant="link" onClick={() => setExpanded(prev => !prev)}>
            {expanded ? 'Show less' : 'Show more'}
          </Button>
        </div>
      )}
    </div>
  )
}