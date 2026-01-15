"use client"

import { AuthButton } from "@/components/auth-button";
import SettingsMenu from "@/components/settings-menu";
import ThemeToggle from "@/components/theme-toggle";
import { usePathname } from "next/navigation";

export default function FloatingActionIcons() {
  // Always show on every screen
  return (
    <div className="fixed z-[9999] flex flex-col gap-4 right-4 bottom-8 items-end">
      <div 
        className="transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)] hover:scale-105 rounded-[28px] p-4 w-16 h-16 flex items-center justify-center bg-secondary-container text-secondary-container-foreground"
      >
        <AuthButton />
      </div>
      <div 
        className="transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)] hover:scale-105 rounded-[28px] p-4 w-16 h-16 flex items-center justify-center bg-tertiary-container text-tertiary-container-foreground"
      >
        <SettingsMenu />
      </div>
      <div 
        className="transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)] hover:scale-105 rounded-[28px] p-4 w-16 h-16 flex items-center justify-center bg-primary-container text-primary-container-foreground"
      >
        <ThemeToggle />
      </div>
    </div>
  );
}
