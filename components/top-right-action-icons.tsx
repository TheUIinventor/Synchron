"use client";

import { AuthButton } from "@/components/auth-button";
import SettingsMenu from "@/components/settings-menu";
import ThemeToggle from "@/components/theme-toggle";
import { usePathname } from "next/navigation";

export function HeaderActionIconsMobile() {
  // Small inline group for mobile headers: visible on md:hidden
  return (
    <div className="md:hidden flex items-center gap-2">
      <div className="w-8 h-8 flex items-center justify-center">
        <AuthButton />
      </div>
      <div className="w-8 h-8 flex items-center justify-center">
        <SettingsMenu />
      </div>
      <div className="w-8 h-8 flex items-center justify-center">
        <ThemeToggle />
      </div>
    </div>
  );
}

export default function TopRightActionIcons() {
  const pathname = usePathname();
  // On the home page or clipboard page, do not render the fixed icons (let the header handle them)
  if (pathname === "/" || pathname === "/home" || pathname.startsWith("/clipboard")) return null;
  return (
    <div className="hidden md:fixed md:top-6 md:right-8 md:z-40 md:flex md:gap-2">
      {/* Desktop fixed icons */}
      <div className="flex gap-2 items-center md:scale-100 md:gap-2">
        <div className="md:w-auto md:h-auto">
          <AuthButton />
        </div>
        <div className="md:w-auto md:h-auto">
          <SettingsMenu />
        </div>
        <div className="md:w-auto md:h-auto">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
