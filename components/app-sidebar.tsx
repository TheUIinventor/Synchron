"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, Bell, Settings, Clipboard } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/timetable", icon: Calendar, label: "Timetable" },
    { href: "/clipboard", icon: Clipboard, label: "Clipboard" },
    { href: "/notices", icon: Bell, label: "Notices" },
    { href: "/settings", icon: Settings, label: "Settings" },
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
    </aside>
  );
}
