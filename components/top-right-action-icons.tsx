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
      <div className="pointer-events-auto transition-transform duration-200 hover:scale-110 hover:shadow-xl rounded-full p-4 w-16 h-16 flex items-center justify-center bg-white/70 dark:bg-gray-900/70 shadow-lg border border-white/30 dark:border-gray-800/40 backdrop-blur-xl"
        style={{ boxShadow: "0 4px 32px 0 rgba(0,0,0,0.10)" }}
      >
        <div className="w-6 h-6 flex items-center justify-center">
          <AuthButton />
        </div>
      </div>
      <div className="pointer-events-auto transition-transform duration-200 hover:scale-110 hover:shadow-xl rounded-full p-4 w-16 h-16 flex items-center justify-center bg-white/70 dark:bg-gray-900/70 shadow-lg border border-white/30 dark:border-gray-800/40 backdrop-blur-xl"
        style={{ boxShadow: "0 4px 32px 0 rgba(0,0,0,0.10)" }}
      >
        <div className="w-6 h-6 flex items-center justify-center">
          <SettingsMenu />
        </div>
      </div>
      <div className="pointer-events-auto transition-transform duration-200 hover:scale-110 hover:shadow-xl rounded-full p-4 w-16 h-16 flex items-center justify-center bg-white/70 dark:bg-gray-900/70 shadow-lg border border-white/30 dark:border-gray-800/40 backdrop-blur-xl"
        style={{ boxShadow: "0 4px 32px 0 rgba(0,0,0,0.10)" }}
      >
        <div className="w-6 h-6 flex items-center justify-center">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
