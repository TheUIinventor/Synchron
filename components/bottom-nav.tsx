"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Calendar, Bell, Menu, Clipboard } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { href: "/", icon: Home, label: "My Synchron" },
    { href: "/timetable", icon: Calendar, label: "Timetable" },
    { href: "/notices", icon: Bell, label: "Notices" },
    { href: "/clipboard", icon: Clipboard, label: "Clipboard" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[10001] p-4 md:hidden" style={{ touchAction: 'pan-y', WebkitTapHighlightColor: 'transparent' }}>
      <div className="mx-auto max-w-md bg-surface-container-high/90 backdrop-blur-lg border border-white/10 shadow-elevation-3 rounded-full px-6 py-3 flex items-center justify-between" style={{ transform: 'translateZ(0)', willChange: 'transform' }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <button
              key={item.href}
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                const target = item.href === "/" ? "https://synchron.work" : `https://synchron.work${item.href}`;

                const btn = e.currentTarget as HTMLElement;
                // prevent accidental double-click navigation
                if (btn.dataset.navigating === "1") return;
                btn.dataset.navigating = "1";

                // Animate the icon container for a short, snappy click feedback
                try {
                  const icon = btn.querySelector('.nav-icon') as HTMLElement | null;
                  if (icon) {
                    icon.style.transition = 'transform 180ms ease';
                    icon.style.transform = 'translateY(2px) scale(0.96)';
                  }
                } catch (err) {}

                // Delay navigation to allow the animation to play
                setTimeout(() => {
                  try {
                    // Hard navigate to canonical domain
                    window.location.assign(target);
                  } catch (e) {
                    try { router.push(item.href) } catch (err) { /* swallow */ }
                  }
                }, 200);
              }}
              className="relative group flex flex-col items-center justify-center bg-transparent border-none"
              aria-label={item.label}
              title={item.label}
            >
              <div
                className={cn(
                  "relative flex items-center justify-center h-12 w-16 rounded-full transition-all duration-500 ease-expressive",
                  isActive
                    ? "bg-primary-container text-primary-container-foreground w-20"
                    : "text-muted-foreground hover:bg-surface-variant/50"
                )}
                style={{ pointerEvents: 'auto' }}
              >
                <div className="nav-icon">
                  <Icon
                    className={cn(
                      "h-6 w-6 transition-transform duration-300",
                      isActive ? "scale-110" : "group-hover:scale-110"
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
