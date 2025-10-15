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
      <AuthButton />
      <SettingsMenu />
      <ThemeToggle />
    </div>
  );
}
