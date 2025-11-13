"use client"
import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useUserSettings } from "@/components/theme-provider"

// Material Symbols mapping for core nav icons (Material 3 expressive style)
const ICON_MAP: Record<string, string> = {
  home: "home",
  timetable: "calendar_month",
  notices: "notifications",
  clipboard: "content_paste",
  awards: "emoji_events",
}

export type NavItem =
  | "home"
  | "timetable"
  | "notices"
  | "bell-times"
  | "clipboard"
  | "awards"
  | "calendar"
  | "library"
  | "canteen"

interface BottomNavProps {
  onNavItemClick?: (item: NavItem) => void
}

export default function BottomNav({ onNavItemClick }: BottomNavProps) {
  const pathname = usePathname()
  const { navigationTabs } = useUserSettings()

  const allNavItems = [
    {
      name: "home" as NavItem,
      icon: ICON_MAP.home,
      label: "Home",
      href: "/",
    },
    {
      name: "timetable" as NavItem,
      icon: ICON_MAP.timetable,
      label: "My Synchron",
      href: "/timetable",
    },
    {
      name: "notices" as NavItem,
      icon: ICON_MAP.notices,
      label: "Notices",
      href: "/notices",
    },
    {
      name: "clipboard" as NavItem,
      icon: ICON_MAP.clipboard,
      label: "Clipboard",
      href: "/clipboard",
    },
    {
      name: "awards" as NavItem,
      icon: ICON_MAP.awards,
      label: "Awards",
      href: "/awards",
    },
  ]

  // Filter nav items based on user preferences
  const navItems = allNavItems.filter((item) => navigationTabs.includes(item.name))

  const handleClick = (item: NavItem) => {
    if (onNavItemClick) {
      onNavItemClick(item)
    }
  }

  return (
    <>
      {/* Mobile Navigation (Bottom) */}
  <nav
        aria-label="Primary navigation"
        className="fixed bottom-0 left-0 right-0 px-3 py-2 z-50 flex justify-between items-stretch md:hidden rounded-t-2xl bg-white/95 dark:bg-slate-900/95 shadow-lg ring-1 ring-slate-100/60 dark:ring-slate-800/60"
      >
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          const IconName = item.icon as string

          return (
            <Link
              key={item.name}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={`group flex flex-col items-center justify-center px-3 py-2 rounded-xl transition-all duration-300 ease-out relative min-w-[3.75rem] ${
                isActive
                  ? "text-theme-primary"
                  : "text-gray-500 dark:text-gray-400 hover:text-theme-primary"
              }`}
              onClick={() => handleClick(item.name)}
            >
              <div className={`relative p-1 rounded-full transition-all duration-200 ${isActive ? "bg-theme-secondary/20 text-theme-primary shadow-md" : "group-hover:shadow-sm"}`}>
                <span className="material-symbols-rounded icon-optimized drop-shadow-sm" style={{ fontSize: 20 }} aria-hidden>
                  {IconName}
                </span>
                {isActive && (
                  <span className="absolute inset-0 rounded-full ring-2 ring-theme-primary/50 animate-pulse-slow" />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-wide font-medium opacity-90 group-hover:opacity-100 transition-opacity">
                {item.label}
              </span>
              {isActive && (
                <div className="absolute -bottom-1.5 w-1 h-1 bg-theme-primary rounded-full shadow-md shadow-theme-primary/40" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Desktop: Material 3 - Expressive Navigation Rail (md+) */}
      <nav
        aria-label="Primary navigation"
        className="hidden md:flex group fixed left-0 top-0 bottom-0 w-14 group-hover:w-56 group-focus-within:w-56 hover:w-56 transition-all duration-200 ease-out flex-col items-start pt-4 pb-4 bg-white/95 dark:bg-slate-900/95 shadow-lg ring-1 ring-slate-100/60 dark:ring-slate-800/60 z-50 rounded-r-2xl overflow-visible"
      >
        {/* Optional top spacer / menu slot */}
        <div className="w-full flex items-center justify-center group-hover:justify-start px-2">
          {/* Could add a hamburger or app logo here in future */}
        </div>

        <div className="w-full mt-2 flex-1 flex flex-col items-start px-1">
      {navItems.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
        const IconName = item.icon as string

            return (
              <Link
                key={item.name}
                href={item.href}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                className={`group/item relative flex items-center w-full my-2 transition-all duration-200 ease-out ${
                  isActive
                    ? "text-theme-primary"
                    : "text-gray-500 dark:text-gray-400 hover:text-theme-primary"
                }`}
                onClick={() => handleClick(item.name)}
              >
                {/* Icon */}
                <div
                  className={`flex items-center justify-center ml-1 mr-1 p-2 rounded-md transition-all duration-200 ${
                    isActive ? "bg-theme-secondary/20 text-theme-primary shadow-md" : "group-hover/item:shadow-sm"
                  }`}
                >
                  <span className="material-symbols-rounded drop-shadow-sm" style={{ fontSize: 20 }} aria-hidden>
                    {IconName}
                  </span>
                </div>

                {/* Label: shows when rail is expanded (hover) or always for active */}
                <span
                  className={`${
                    isActive
                      ? "ml-3 pr-3 py-2 rounded-full bg-theme-secondary/20 dark:bg-theme-secondary/30 text-sm font-medium text-theme-primary"
                      : "ml-3 pr-3 py-2 rounded-full text-sm font-medium hidden"
                  } group-hover:inline-flex group-focus-within:inline-flex transition-all duration-150 items-center`}
                >
                  {item.label}
                </span>

                {/* Active indicator (edge pill) */}
                {isActive && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-theme-primary rounded-full shadow-md shadow-theme-primary/40" />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
