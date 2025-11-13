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
  const [expanded, setExpanded] = React.useState(false)

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
        className={`hidden md:flex fixed left-0 top-0 bottom-0 transition-all duration-300 ease-out flex-col items-start pt-3 pb-4 bg-white/95 dark:bg-slate-900/95 shadow-md ring-1 ring-slate-100/60 dark:ring-slate-800/60 z-50 rounded-r-2xl overflow-hidden ${
          expanded ? "w-64 pl-4" : "w-16 pl-0"
        }`}
      >
        {/* Toggle button to expand/collapse the rail */}
        <div className="w-full flex items-center justify-center">
          <button
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
            onClick={() => setExpanded((s) => !s)}
            className="m-2 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 20 }} aria-hidden>
              menu
            </span>
          </button>
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
                className={`group/item relative flex items-center ${expanded ? "justify-start px-2" : "justify-center px-0"} w-full my-2 transition-all duration-300 ease-out ${
                  isActive
                    ? "text-theme-primary"
                    : "text-gray-600 dark:text-gray-300 hover:text-theme-primary"
                }`}
                onClick={() => handleClick(item.name)}
              >
                {/* Render exact pill when expanded and active */}
                {expanded ? (
                  isActive ? (
                    <div className="flex items-center gap-3 px-3 py-2 rounded-2xl bg-theme-secondary/20 text-theme-primary shadow-sm">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-theme-secondary text-theme-primary">
                        <span className="material-symbols-rounded" style={{ fontSize: 20 }} aria-hidden>
                          {IconName}
                        </span>
                      </div>
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-600 dark:text-gray-300">
                        <span className="material-symbols-rounded" style={{ fontSize: 20 }} aria-hidden>
                          {IconName}
                        </span>
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-200">{item.label}</span>
                    </div>
                  )
                ) : (
                  // Collapsed: pill behind icon with label beneath (image 2 style)
                  <div className="w-full flex flex-col items-center">
                    <div className={`flex items-center justify-center rounded-2xl transition-colors duration-200 ${
                      isActive ? "px-3 py-3 bg-theme-secondary/30" : "px-2 py-2"
                    }`}>
                      <div className={`${isActive ? "w-10 h-10 rounded-lg flex items-center justify-center bg-theme-secondary text-theme-primary shadow-md" : "w-10 h-10 rounded-lg flex items-center justify-center text-gray-600 dark:text-gray-300"}`}>
                        <span className="material-symbols-rounded" style={{ fontSize: 20 }} aria-hidden>
                          {IconName}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs mt-2 text-gray-700 dark:text-gray-200">{item.label}</span>
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
