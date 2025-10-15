"use client"

import { AuthButton } from "@/components/auth-button";
import SettingsMenu from "@/components/settings-menu";
import ThemeToggle from "@/components/theme-toggle";
import { usePathname } from "next/navigation";

// Apple-style floating glass effect for each button
const glass =
  "backdrop-blur-xl bg-white/60 dark:bg-gray-900/60 shadow-lg border border-white/30 dark:border-gray-800/40";

export default function FloatingActionIcons() {
  const pathname = usePathname();
  // Hide on clipboard page
  if (pathname.startsWith("/clipboard")) return null;

  return (
    <div className="fixed z-50 flex flex-col gap-6 right-4 bottom-8 items-end pointer-events-none">
      <div className="pointer-events-auto transition-transform duration-300 hover:scale-105 rounded-full p-3 " style={{ boxShadow: "0 4px 32px 0 rgba(0,0,0,0.10)" }}>
        <AuthButton />
      </div>
      <div className="pointer-events-auto transition-transform duration-300 hover:scale-105 rounded-full p-3 " style={{ boxShadow: "0 4px 32px 0 rgba(0,0,0,0.10)" }}>
        <SettingsMenu />
      </div>
      <div className="pointer-events-auto transition-transform duration-300 hover:scale-105 rounded-full p-3 " style={{ boxShadow: "0 4px 32px 0 rgba(0,0,0,0.10)" }}>
        <ThemeToggle />
      </div>
    </div>
  );
}
