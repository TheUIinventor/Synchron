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
    <>
      {/* Mobile Navigation (Bottom) */}
      <div className="fixed bottom-0 left-0 right-0 glass-nav px-2 py-2 z-50 flex justify-around items-center md:hidden">
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          const IconComponent = item.icon

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 ease-in-out relative ${
                isActive
                  ? "text-theme-primary"
                  : "text-gray-500 dark:text-gray-400 hover:bg-white/15 dark:hover:bg-white/8"
              }`}
              onClick={() => handleClick(item.name)}
            >
              <div
                className={`p-1 rounded-full transition-all duration-200 ${isActive ? "glass-icon-enhanced bg-theme-secondary" : "glass-icon"}`}
              >
                <IconComponent className="h-5 w-5" /> {/* Mobile icon size */}
              </div>
              <span className="text-xs mt-1">{item.label}</span>
              {isActive && (
                <div className="absolute -bottom-2 w-1 h-1 bg-theme-primary rounded-full shadow-lg shadow-theme-primary/50" />
              )}
            </Link>
          )
        })}
      </div>

      {/* Desktop Navigation (Left Vertical) */}
      <div className="hidden md:flex fixed left-0 top-0 bottom-0 w-24 flex-col justify-center items-center p-4 glass-nav z-50">
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          const IconComponent = item.icon

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 ease-in-out relative w-full my-1 ${
                isActive
                  ? "text-theme-primary"
                  : "text-gray-500 dark:text-gray-400 hover:bg-white/15 dark:hover:bg-white/8"
              }`}
              onClick={() => handleClick(item.name)}
            >
              <div
                className={`p-1 rounded-full transition-all duration-200 ${isActive ? "glass-icon-enhanced bg-theme-secondary" : "glass-icon"}`}
              >
                <IconComponent className="h-4 w-4" /> {/* Desktop icon size */}
              </div>
              <span className="text-xs mt-1 text-center">{item.label}</span>
              {isActive && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-theme-primary rounded-full shadow-lg shadow-theme-primary/50" />
              )}
            </Link>
          )
        })}
      </div>
    </>
  )
}
