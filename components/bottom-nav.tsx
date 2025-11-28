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
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:hidden pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md bg-surface-container-high/90 backdrop-blur-lg border border-white/10 shadow-elevation-3 rounded-full px-6 py-3 flex items-center justify-between">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative group flex flex-col items-center justify-center"
            >
              <div
                className={cn(
                  "relative flex items-center justify-center h-12 w-16 rounded-full transition-all duration-500 ease-expressive",
                  isActive
                    ? "bg-primary-container text-primary-container-foreground w-20"
                    : "text-muted-foreground hover:bg-surface-variant/50"
                )}
              >
                <Icon
                  className={cn(
                    "h-6 w-6 transition-transform duration-300",
                    isActive ? "scale-110" : "group-hover:scale-110"
                  )}
                  // Simulate filled icon state if library supported it, or just use bold stroke
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>
              {/* Optional: Label appears only on non-mobile or specific states if desired, 
                  but strictly Expressive Mobile Bottom bar usually omits labels for core nav 
                  or keeps them always. We'll omit for the clean pill look here. */}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
