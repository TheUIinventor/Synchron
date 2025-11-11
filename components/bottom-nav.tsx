"use client"
import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Calendar, Bell, Clipboard, Award, Home } from "lucide-react"
import { useUserSettings } from "@/components/theme-provider"

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
      icon: Home, // Use component directly
      label: "Home",
      href: "/",
    },
    {
      name: "timetable" as NavItem,
      icon: Calendar,
      label: "My Synchron",
      href: "/timetable",
    },
    {
      name: "notices" as NavItem,
      icon: Bell,
      label: "Notices",
      href: "/notices",
    },
    {
      name: "clipboard" as NavItem,
      icon: Clipboard,
      label: "Clipboard",
      href: "/clipboard",
    },
    {
      name: "awards" as NavItem,
      icon: Award,
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
        className="fixed bottom-0 left-0 right-0 glass-nav glass-border px-3 py-2 z-50 flex justify-between items-stretch md:hidden rounded-t-2xl backdrop-blur supports-[backdrop-filter]:bg-white/40 dark:supports-[backdrop-filter]:bg-slate-900/50"
      >
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          const IconComponent = item.icon

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
              <div className={`relative p-1 rounded-full transition-all duration-300 ${isActive ? "glass-icon-enhanced bg-theme-secondary" : "glass-icon group-hover:shadow-md"}`}>
                <IconComponent className="h-5 w-5 drop-shadow-sm" />
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

      {/* Desktop Navigation (Left Vertical) */}
  <nav
        aria-label="Primary navigation"
        className="hidden md:flex fixed left-0 top-0 bottom-0 w-24 flex-col justify-center items-center p-4 glass-nav glass-border z-50 rounded-r-2xl backdrop-blur supports-[backdrop-filter]:bg-white/40 dark:supports-[backdrop-filter]:bg-slate-900/40"
      >
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          const IconComponent = item.icon

          return (
            <Link
              key={item.name}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={`group flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 ease-out relative w-full my-1 ${
                isActive
                  ? "text-theme-primary"
                  : "text-gray-500 dark:text-gray-400 hover:text-theme-primary"
              }`}
              onClick={() => handleClick(item.name)}
            >
              <div className={`relative p-1 rounded-full transition-all duration-300 ${isActive ? "glass-icon-enhanced bg-theme-secondary" : "glass-icon group-hover:shadow-md"}`}>
                <IconComponent className="h-4 w-4 drop-shadow-sm" />
                {isActive && (
                  <span className="absolute inset-0 rounded-full ring-2 ring-theme-primary/50 animate-pulse-slow" />
                )}
              </div>
              <span className="text-[10px] mt-1 text-center tracking-wide font-medium opacity-90 group-hover:opacity-100 transition-opacity">{item.label}</span>
              {isActive && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-theme-primary rounded-full shadow-md shadow-theme-primary/40" />
              )}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
