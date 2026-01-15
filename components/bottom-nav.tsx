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
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 md:hidden" style={{ touchAction: 'pan-y', WebkitTapHighlightColor: 'transparent' }}>
      <div 
        className="mx-auto max-w-md bg-surface-container-high border border-surface-variant rounded-[28px] px-6 py-3 flex items-center justify-between"
        style={{ 
          transform: 'translateZ(0)', 
          willChange: 'transform',
          boxShadow: 'none'
        }}
      >
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
                  "relative flex items-center justify-center h-12 w-16 transition-all duration-500",
                  "ease-[cubic-bezier(0.2,0,0,1)]",
                  isActive
                    ? "bg-primary-container text-primary-container-foreground w-20 rounded-[24px]"
                    : "text-on-surface-variant hover:bg-surface-variant rounded-[24px]"
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
            </Link>
          );
        })}
      </div>
    </div>
  );
}
