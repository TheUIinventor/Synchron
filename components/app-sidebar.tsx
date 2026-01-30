"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Home, Calendar, Bell, Clipboard, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimetable } from "@/contexts/timetable-context";
import { useLoginPromptVisible } from "@/components/login-prompt-banner";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, isRefreshing, timetableSource } = useTimetable() as any
  const { visible: loginPromptVisible } = useLoginPromptVisible()
  const navItems = [
    { href: "/", icon: Home, label: "My Synchron" },
    { href: "/timetable", icon: Calendar, label: "Timetable" },
    { href: "/notices", icon: Bell, label: "Notices" },
    { href: "/clipboard", icon: Clipboard, label: "Clipboard" },
  ];

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-[9999] hidden md:flex flex-col items-center w-20 lg:w-24 py-8 bg-surface-container/80 backdrop-blur-md border-r border-border/50">
      <div className="flex-1 flex flex-col items-center gap-4 w-full">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onPointerUp={() => {
                try { router.push(item.href) } catch (e) {}
              }}
              className="group flex flex-col items-center gap-1 w-full px-2 bg-transparent border-none cursor-pointer"
              aria-label={item.label}
              title={item.label}
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
      {/* cloud / sync indicator at bottom center */}
      <div className="w-full flex items-center justify-center mt-6">
        {isLoading || isRefreshing ? (
          <Cloud className="h-5 w-5 animate-spin text-primary" />
        ) : loginPromptVisible ? (
          <div className="relative w-6 h-6" title="Not logged in">
            <Cloud className="h-6 w-6 text-muted-foreground" />
            <span className="absolute -right-0 -top-0 bg-white rounded-full">
              <svg className="h-3 w-3 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </span>
          </div>
        ) : timetableSource && timetableSource !== 'fallback-sample' && timetableSource !== 'cache' ? (
          <div className="relative w-6 h-6" title="Synced to cloud">
            <Cloud className="h-6 w-6 text-muted-foreground" />
            <span className="absolute -right-0 -top-0 bg-white rounded-full">
              <svg className="h-3 w-3 text-green-600" viewBox="0 0 24 24" fill="currentColor"><path d="M20.285 6.709a7 7 0 0 0-9.9 9.9 7.002 7.002 0 0 0 9.9-9.9zm-9.285 9.291l-3.292-3.291 1.414-1.414 1.877 1.877 4.95-4.95 1.414 1.414L11 16z"/></svg>
            </span>
          </div>
        ) : (
          <Cloud className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
    </aside>
  );
}

