"use client"

import { AuthButton } from "@/components/auth-button";
import SettingsMenu from "@/components/settings-menu";
import ThemeToggle from "@/components/theme-toggle";
import { usePathname } from "next/navigation";

// Apple-style floating glass effect for each button
const glass =
  "backdrop-blur-xl bg-white/60 dark:bg-gray-900/60 shadow-lg border border-white/30 dark:border-gray-800/40";

export default function FloatingActionIcons() {
  // Always show on every screen
  return (
    <div className="fixed z-[9999] flex flex-col gap-6 right-4 bottom-8 items-end">
      <div className={"transition-transform duration-300 hover:scale-105 rounded-full p-4 w-16 h-16 flex items-center justify-center glass-button backdrop-blur-xl bg-white/60 dark:bg-gray-900/60 shadow-lg border border-white/30 dark:border-gray-800/40"}>
        <AuthButton />
      </div>
      <div className={"transition-transform duration-300 hover:scale-105 rounded-full p-4 w-16 h-16 flex items-center justify-center glass-button backdrop-blur-xl bg-white/60 dark:bg-gray-900/60 shadow-lg border border-white/30 dark:border-gray-800/40"}>
        <SettingsMenu />
      </div>
      <div className={"transition-transform duration-300 hover:scale-105 rounded-full p-4 w-16 h-16 flex items-center justify-center glass-button backdrop-blur-xl bg-white/60 dark:bg-gray-900/60 shadow-lg border border-white/30 dark:border-gray-800/40"}>
        <ThemeToggle />
      </div>
    </div>
  );
}
