import type { NavItem } from "@/components/bottom-nav"

// Get the most used section from localStorage
export const getMostUsedSection = (): NavItem => {
  if (typeof window === "undefined") return "timetable"

  const usageData = localStorage.getItem("synchron-usage-data")
  if (!usageData) return "timetable"

  try {
    const parsed = JSON.parse(usageData) as Record<NavItem | "settings", number>
    let mostUsed: NavItem = "timetable"
    let highestCount = 0

    Object.entries(parsed).forEach(([key, count]) => {
      if (count > highestCount && key !== "settings") {
        highestCount = count
        mostUsed = key as NavItem
      }
    })

    return mostUsed
  } catch (error) {
    return "timetable"
  }
}

// Track usage of a section
export const trackSectionUsage = (section: NavItem | "settings"): void => {
  if (typeof window === "undefined") return

  const usageData = localStorage.getItem("synchron-usage-data")
  let parsed: Record<NavItem | "settings", number> = {
    home: 0,
    timetable: 0,
    notices: 0,
    clipboard: 0,
    awards: 0,
    "bell-times": 0,
    calendar: 0,
    library: 0,
    canteen: 0,
    settings: 0,
  }

  if (usageData) {
    try {
      parsed = JSON.parse(usageData) as Record<NavItem | "settings", number>
    } catch (error) {
      // Use default if parsing fails
    }
  }

  // Increment the count for this section
  parsed[section] = (parsed[section] || 0) + 1

  // Save back to localStorage
  localStorage.setItem("synchron-usage-data", JSON.stringify(parsed))
}
