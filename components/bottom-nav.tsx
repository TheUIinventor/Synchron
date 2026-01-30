"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, Calendar, Bell, Clipboard } from "lucide-react";
import { cn } from "@/lib/utils";

// Simplified BottomNav: use semantic buttons that call router.push on pointer up
// and keyboard activation. This avoids relying on anchor default behavior
// which can be intercepted by global handlers.
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { href: "/", icon: Home, label: "My Synchron" },
    { href: "/timetable", icon: Calendar, label: "Timetable" },
    { href: "/notices", icon: Bell, label: "Notices" },
    { href: "/clipboard", icon: Clipboard, label: "Clipboard" },
  ];

  const navigate = (href: string) => {
    try { router.push(href) } catch (e) { try { window.location.href = href } catch {} }
  }

  return (
    <nav aria-label="Primary navigation" className="fixed bottom-0 left-0 right-0 z-[10001] p-4 md:hidden" style={{ touchAction: 'pan-y', WebkitTapHighlightColor: 'transparent' }}>
      <div className="mx-auto max-w-md bg-surface-container-high/90 backdrop-blur-lg border border-white/10 shadow-elevation-3 rounded-full px-6 py-3 flex items-center justify-between" style={{ transform: 'translateZ(0)', willChange: 'transform' }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <button
              key={item.href}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              title={item.label}
              onPointerUp={() => navigate(item.href)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(item.href) } }}
              className="relative group flex flex-col items-center justify-center bg-transparent border-none"
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
                <Icon
                  className={cn(
                    "h-6 w-6 transition-transform duration-300",
                    isActive ? "scale-110" : "group-hover:scale-110"
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>
            </button>
          )
        })}
      </div>
    </nav>
  );
}
