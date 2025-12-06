"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, Bell, Clipboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimetable } from "@/contexts/timetable-context";

export function AppSidebar() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", icon: Home, label: "My Synchron" },
    { href: "/timetable", icon: Calendar, label: "Timetable" },
    { href: "/notices", icon: Bell, label: "Notices" },
    { href: "/clipboard", icon: Clipboard, label: "Clipboard" },
  ];

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 hidden md:flex flex-col items-center w-20 lg:w-24 py-8 bg-surface-container/80 backdrop-blur-md border-r border-border/50">
      <div className="flex-1 flex flex-col items-center gap-4 w-full">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex flex-col items-center gap-1 w-full px-2"
            >
              <div
                className={cn(
                  "flex items-center justify-center w-14 h-8 rounded-full transition-all duration-300 ease-expressive",
                  isActive
                    ? "bg-secondary-container text-secondary-container-foreground"
                    : "text-muted-foreground hover:bg-surface-variant/50 hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "h-6 w-6 transition-transform duration-300",
                    isActive ? "scale-110" : "group-hover:scale-110"
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium tracking-wide transition-colors duration-300",
                  isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
      {/* Bell times widget */}
      <div className="w-full px-2 mt-3">
        <BellTimesSidebar />
      </div>
    </aside>
  );
}

function BellTimesSidebar() {
  const tt = useTimetable() as any;
  const dateObj: Date = tt?.selectedDateObject || new Date()

  const day = dateObj.getDay()
  // Map JS day -> bucket
  const bucket = day === 5 ? "Fri" : (day === 3 || day === 4) ? "Wed/Thurs" : (day === 1 || day === 2) ? "Mon/Tues" : "Mon/Tues"

  const bellTimes: { period: string; time: string }[] = (tt?.bellTimes && tt.bellTimes[bucket]) || []

  // Show only breaks and lunches allocation prominently
  const breaks = bellTimes.filter((b: any) => /recess|break|lunch|end of day|end-of-day|endofday|end of day/i.test(String(b.period)))

  if (!bellTimes || bellTimes.length === 0) return (
    <div className="w-full text-center text-[11px] text-muted-foreground">No bell times</div>
  )

  return (
    <div className="w-full flex flex-col items-center gap-1">
      <div className="text-[11px] font-medium text-muted-foreground">Today</div>
      <div className="w-full mt-1 rounded-md bg-surface-2/80 p-2">
        {bellTimes.slice(0, 6).map((b: any, i: number) => (
          <div key={i} className="flex justify-between text-[12px] text-foreground/90">
            <div className="truncate">{b.period}</div>
            <div className="ml-2 text-muted-foreground">{b.time}</div>
          </div>
        ))}
        {breaks.length > 0 && (
          <div className="mt-2 border-t border-border/30 pt-1 text-[11px] text-muted-foreground">
            <div className="font-medium">Breaks</div>
            {breaks.map((b: any, i: number) => (
              <div key={i} className="flex justify-between text-[12px]">
                <div>{b.period}</div>
                <div className="text-muted-foreground">{b.time}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
