"use client"
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
    <nav className="fixed left-0 top-0 bottom-0 z-50 flex w-16 flex-col items-center gap-3 overflow-y-auto px-3 py-6 glass-nav glass-border sm:w-20 lg:w-24">
      <div className="flex w-full flex-col gap-2">
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          const IconComponent = item.icon

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`group flex w-full flex-col items-center gap-1 rounded-lg px-2 py-2 text-center text-[0.7rem] font-medium transition-all duration-200 ease-in-out ${
                isActive
                  ? "text-theme-primary"
                  : "text-gray-500 dark:text-gray-400 hover:bg-white/15 dark:hover:bg-white/8"
              }`}
              onClick={() => handleClick(item.name)}
            >
              <div
                className={`flex size-8 items-center justify-center rounded-full transition-all duration-200 ${
                  isActive ? "glass-icon-enhanced bg-theme-secondary" : "glass-icon"
                }`}
              >
                <IconComponent className="h-4 w-4" />
              </div>
              <span className="leading-tight">{item.label}</span>
              {isActive && (
                <span className="mt-1 h-1 w-full rounded-full bg-theme-primary shadow-lg shadow-theme-primary/40" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
