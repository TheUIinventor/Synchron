"use client";

import { AuthButton } from "@/components/auth-button";
import SettingsMenu from "@/components/settings-menu";
import ThemeToggle from "@/components/theme-toggle";
import { usePathname } from "next/navigation";

export default function TopRightActionIcons() {
  const pathname = usePathname();
  // On the home page or clipboard page, do not render the fixed icons (let the header handle them)
  if (pathname === "/" || pathname === "/home" || pathname.startsWith("/clipboard")) return null;
  return (
    <div className="fixed top-6 right-8 z-40 flex gap-2">
      {/* Desktop: original size. Mobile: smaller, tighter, and nudged left to avoid overlapping content */}
      <div className="flex gap-2 items-center md:scale-100 md:gap-2 scale-90 -mr-2 md:-mr-0">
        <div className="md:w-auto w-8 h-8 md:h-auto md:w-auto">
          <AuthButton />
        </div>
        <div className="md:w-auto w-8 h-8 md:h-auto md:w-auto">
          <SettingsMenu />
        </div>
        <div className="md:w-auto w-8 h-8 md:h-auto md:w-auto">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
