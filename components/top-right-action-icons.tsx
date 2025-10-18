"use client";

import { AuthButton } from "@/components/auth-button";
import SettingsMenu from "@/components/settings-menu";
import ThemeToggle from "@/components/theme-toggle";
import { usePathname } from "next/navigation";

// Always-render fixed circular buttons in the top-right corner.
// They are visible on all viewports and remain fixed while scrolling.
export default function TopRightActionIcons() {
  // Slightly smaller size to avoid overlapping headings; keep circular shape
  const size = "w-9 h-9"; // one step smaller than previous
  // Move slightly lower and left so it doesn't overlap the header text
  return (
    <div className="fixed top-7 right-6 z-50 flex items-center gap-2">
      <div className={`rounded-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm shadow-sm ${size} flex items-center justify-center border border-gray-200 dark:border-gray-800`}>
        <AuthButton />
      </div>
      <div className={`rounded-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm shadow-sm ${size} flex items-center justify-center border border-gray-200 dark:border-gray-800`}>
        <SettingsMenu />
      </div>
      <div className={`rounded-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm shadow-sm ${size} flex items-center justify-center border border-gray-200 dark:border-gray-800`}>
        <ThemeToggle />
      </div>
    </div>
  );
}
