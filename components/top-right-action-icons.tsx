"use client";
import { AuthButton } from "@/components/auth-button";
import SettingsMenu from "@/components/settings-menu";
import ThemeToggle from "@/components/theme-toggle";

export default function TopRightActionIcons() {
  return (
    <div
      className="fixed top-6 right-8 z-50 flex gap-4"
      style={{ pointerEvents: "none" }}
    >
      <div className="rounded-full w-10 h-10 glass-button border-0 hover:bg-white/30 dark:hover:bg-white/15 transition-all duration-200 bg-transparent"
        style={{ boxShadow: "0 4px 32px 0 rgba(0,0,0,0.10)" }}
      >
        <div className="w-6 h-6 flex items-center justify-center">
          <AuthButton />
        </div>
      </div>
      <div className="rounded-full w-10 h-10 glass-button border-0 hover:bg-white/30 dark:hover:bg-white/15 transition-all duration-200 bg-transparent"
        style={{ boxShadow: "0 4px 32px 0 rgba(0,0,0,0.10)" }}
      >
        <div className="w-6 h-6 flex items-center justify-center">
          <SettingsMenu />
        </div>
      </div>
      <div className="rounded-full w-10 h-10 glass-button border-0 hover:bg-white/30 dark:hover:bg-white/15 transition-all duration-200 bg-transparent"
        style={{ boxShadow: "0 4px 32px 0 rgba(0,0,0,0.10)" }}
      >
        <div className="w-6 h-6 flex items-center justify-center">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
