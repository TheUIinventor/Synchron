"use client";
import { useEffect, useState } from "react";
import InstallAppButton from "@/components/install-app-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Filter, Utensils } from "lucide-react";
"use client";
import { useEffect, useMemo, useState } from "react";
import InstallAppButton from "@/components/install-app-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Filter, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";

const FIXED_YEARS = [
  "All",
  "Year 7",
  "Year 8",
  "Year 9",
  "Year 10",
  "Year 11",
  "Year 12",
  "Staff",
];

function expandYearTags(displayYears: string) {
  if (!displayYears || typeof displayYears !== 'string') return [];
  const tags = displayYears.split(',').map((y: string) => y.trim()).filter(Boolean);
  const expanded: string[] = [];
  for (const tag of tags) {
    const rangeMatch = tag.match(/^Years? (\d+)-(\d+)$/i);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      for (let y = start; y <= end; y++) expanded.push(`Year ${y}`);
      continue;
    }
    const singleMatch = tag.match(/^Year (\d+)$/i);
    if (singleMatch) {
      expanded.push(`Year ${singleMatch[1]}`);
      continue;
    }
    expanded.push(tag);
  }
  return expanded;
}

function normalizeTag(t: string) {
  return String(t || '').trim().toLowerCase();
}

export default function NoticesClient() {
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>("All");

  useEffect(() => {
    let mounted = true;
    async function fetchNotices() {
      setLoading(true);
      setError(null);
      try {
        let data: any = null;
        if (typeof window !== 'undefined') {
          const cached = sessionStorage.getItem('notices-data');
          if (cached) data = JSON.parse(cached);
        }
        if (!data) {
          const res = await fetch('/api/notices');
          if (!res.ok) throw new Error('Failed to fetch notices');
          data = await res.json();
        }
        const list = Array.isArray(data) ? data : (Array.isArray(data.notices) ? data.notices : (Array.isArray(data.news) ? data.news : []));
        if (mounted) setNotices(list);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchNotices();
    return () => { mounted = false };
  }, []);

  // Compute filtered list efficiently
  const filteredNotices = useMemo(() => {
    if (selectedYear === 'All') return notices;
    return notices.filter(n => {
      if (!n || !n.displayYears) return false;
      const tags = expandYearTags(n.displayYears);
      if (tags.includes(selectedYear)) return true;
      const lowerTags = tags.map(normalizeTag);
      // 'All' or 'All Students and Staff' -> visible to everyone
      if (lowerTags.some(t => ['all', 'all students and staff', 'all students & staff'].includes(t))) return true;
      // 'All Students' -> visible to student years (Year 7-12)
      if (lowerTags.includes('all students') && selectedYear.startsWith('Year ')) return true;
      // Staff tag
      if (tags.includes('Staff') && selectedYear === 'Staff') return true;
      return false;
    });
  }, [notices, selectedYear]);

  return (
    <main className="notices-main w-full pb-24">
      <div className="mx-auto max-w-3xl px-4">
        {/* Sticky header like timetable: title + filters */}
        <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-md py-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl md:text-3xl font-semibold">Notices</h2>

            {/* Desktop chips */}
            <div className="hidden md:flex gap-2 items-center overflow-x-auto no-scrollbar">
              {FIXED_YEARS.map(y => (
                <Button
                  key={y}
                  variant={selectedYear === y ? 'default' : 'outline'}
                  onClick={() => setSelectedYear(y)}
                  className={cn('rounded-full px-4 py-2 select-none', selectedYear === y ? 'shadow-md' : 'hover:bg-surface-variant')}
                >
                  {y}
                </Button>
              ))}
            </div>

            {/* Mobile select */}
            <div className="md:hidden w-48">
              <Select value={selectedYear} onValueChange={(v) => setSelectedYear(String(v))}>
                <SelectTrigger className="w-full rounded-full bg-surface-container-high border-none h-10 px-3">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 opacity-60" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {FIXED_YEARS.map(fy => <SelectItem key={fy} value={fy}>{fy}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="mt-6 space-y-4">
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
            filteredNotices.map((notice, idx) => {
              const title = notice.title || notice.type || 'Notice';
              const body = (notice.text || notice.details || notice.content || notice.message || '').replace(/^<p>/i, '').replace(/<\/p>$/i, '').trim();
              const dateStr = notice.publishedAt || notice.date || notice.createdAt || '';
              const author = notice.authorName || notice.author || '';
              return (
                <Card key={idx} className="overflow-hidden border-none shadow-elevation-1 hover:shadow-elevation-2 transition-all duration-200 bg-surface-container-low">
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-lg font-semibold leading-tight">{title}</CardTitle>
                        <div className="mt-1 text-sm text-muted-foreground flex items-center gap-3">
                          {author && <span className="font-medium">{author}</span>}
                          {dateStr && <time className="opacity-80">{new Date(dateStr).toLocaleDateString()}</time>}
                        </div>
                      </div>
                      {notice.displayYears && (
                        <Badge variant="secondary" className="shrink-0 bg-primary/10 text-primary">
                          {notice.displayYears}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground px-4 pb-4">
                    <div dangerouslySetInnerHTML={{ __html: body }} />
                    {notice.link && (
                      <div className="mt-4">
                        <a href={notice.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View original</a>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })
          ) : (
            <div className="py-16 text-center">
              <Utensils className="h-12 w-12 mx-auto mb-4 text-primary/40" />
              <h3 className="text-xl font-bold text-on-surface mb-2">No notices available</h3>
              <p className="text-on-surface-variant">Nothing to see here for {selectedYear}</p>
            </div>
          )}

          <div className="flex justify-center pt-6 pb-12">
            <InstallAppButton />
          </div>
        </div>
      </div>
    </main>
  );
}