"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, Bell, Menu, Clipboard } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", icon: Home, label: "My Synchron" },
    { href: "/timetable", icon: Calendar, label: "Timetable" },
    { href: "/notices", icon: Bell, label: "Notices" },
    { href: "/clipboard", icon: Clipboard, label: "Clipboard" },
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 py-2 px-2 md:hidden pointer-events-none"
      style={{ touchAction: 'pan-y', WebkitTapHighlightColor: 'transparent', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
    >
      <div className="pointer-events-auto mx-auto max-w-md bg-surface-container-high/90 backdrop-blur-lg border border-white/10 shadow-elevation-3 rounded-full px-4 py-2 flex items-center justify-between" style={{ transform: 'translateZ(0)', willChange: 'transform' }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href} className="relative group flex items-center justify-center px-1">
              <div
                className={cn(
                  "relative flex items-center justify-center h-10 w-12 rounded-full transition-all duration-200",
                  isActive ? "bg-primary-container text-primary-container-foreground" : "text-muted-foreground hover:bg-surface-variant/40"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    isActive ? "scale-105" : "group-hover:scale-105"
                  )}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
