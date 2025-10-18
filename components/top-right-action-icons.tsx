"use client";

import { AuthButton } from "@/components/auth-button";
import SettingsMenu from "@/components/settings-menu";
import ThemeToggle from "@/components/theme-toggle";
import { useState, useEffect } from "react";

// Always-render fixed circular buttons in the top-right corner.
// They are visible on all viewports and remain fixed while scrolling.
export default function TopRightActionIcons() {
  // Restore original circular size and only show on mobile (hide on md+)
  const size = "w-10";

  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    function update() {
      setIsMobile(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // If not mobile, do not render (this prevents duplicates on desktop)
  if (!isMobile) return null;

  // Small fixed icons, mobile-only to avoid duplicating the desktop header icons
  // Use aspect-square to guarantee perfect circles and overflow-hidden to crop
  // any inner padding from child components.
  return (
    <div className="fixed top-6 right-6 z-50 flex items-center gap-3">
      <div className={`${size} aspect-square rounded-full overflow-hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm shadow flex items-center justify-center border border-gray-200 dark:border-gray-800`}>
        <div className="w-full h-full flex items-center justify-center">
          <AuthButton />
        </div>
      </div>
      <div className={`${size} aspect-square rounded-full overflow-hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm shadow flex items-center justify-center border border-gray-200 dark:border-gray-800`}>
        <div className="w-full h-full flex items-center justify-center">
          <SettingsMenu />
        </div>
      </div>
      <div className={`${size} aspect-square rounded-full overflow-hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm shadow flex items-center justify-center border border-gray-200 dark:border-gray-800`}>
        <div className="w-full h-full flex items-center justify-center">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
