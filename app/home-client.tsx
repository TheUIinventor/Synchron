"use client";

import { Bagel_Fat_One } from "next/font/google";
import { formatDate, getCurrentDay } from "../utils/time-utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const bagel = Bagel_Fat_One({ weight: "400", subsets: ["latin"], display: "swap", variable: "--font-bagel-fat-one" });

export default function HomeClient() {
  const day = getCurrentDay();
  const pretty = formatDate();

  return (
    <main className="p-8 mt-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className={`${bagel.className} text-7xl leading-tight tracking-tight`}>{day}</h2>
        <p className="text-sm text-muted-foreground mt-1">{pretty}</p>
      </div>

      {/* Dashboard grid: large hero on left, timetable column on right */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8">
          {/* Hero card (current lesson) */}
          <Card className="mb-6 rounded-[36px] overflow-hidden bg-gradient-to-br from-purple-100/80 to-purple-50/80 text-purple-900 shadow-xl border border-gray-200/10 p-8">
            <CardHeader className="p-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-purple-200/60 text-purple-800 px-3 py-1 text-sm">Now</span>
                </div>
                <div className="text-purple-700">{/* location icon placeholder */}</div>
              </div>
              <CardTitle className="text-6xl font-bold mt-6">HIS B</CardTitle>
              <CardDescription className="text-purple-700 mt-2">402 • PAUV</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div>
                <div className="h-3 bg-purple-200 rounded-full">
                  <div className="h-3 bg-purple-700 rounded-full" style={{ width: '55%' }} />
                </div>
                <div className="flex justify-between mt-3 text-sm text-purple-700">
                  <span>09:00</span>
                  <span>10:00</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lower row: Up Next + Notices */}
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-7">
              <Card className="rounded-2xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">→</span>
                      <span className="text-sm text-muted-foreground">Up Next (29m)</span>
                    </div>
                  </div>
                  <CardTitle className="text-xl font-semibold">ENG B</CardTitle>
                  <CardDescription>401</CardDescription>
                </CardHeader>
              </Card>
            </div>
            <div className="col-span-12 md:col-span-5">
              <Card className="rounded-2xl bg-amber-50">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">🔔</span>
                    <span className="text-sm text-muted-foreground">Notices</span>
                  </div>
                  <CardTitle className="text-2xl">View</CardTitle>
                  <CardDescription>Daily Notices</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>

        {/* Right column: daily timetable list */}
        <aside className="col-span-12 lg:col-span-4">
          <Card className="rounded-[28px] p-4 bg-white/60 shadow-md border border-gray-100">
            <CardHeader className="px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/></svg>
                <span className="font-semibold">{day}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { time: '09:00', title: 'HIS B', room: '402' },
                  { time: '10:05', title: 'ENG B', room: '401' },
                  { time: '11:25', title: 'SCI B', room: '602' },
                  { time: '13:05', title: 'SP 8', room: '' },
                ].map((item) => (
                  <div key={item.time} className="flex items-start gap-4">
                    <div className="w-16 text-sm text-purple-700">{item.time}</div>
                    <div className="flex-1">
                      <div className={`${item.time === '09:00' ? 'rounded-2xl bg-purple-100 p-4 shadow-md' : 'rounded-2xl bg-white p-4 shadow-sm'}`}>{item.title}<div className="text-xs text-purple-600 mt-1">{item.room}</div></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}
