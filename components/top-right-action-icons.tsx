"use client";
import { AuthButton } from "@/components/auth-button";
import SettingsMenu from "@/components/settings-menu";
import ThemeToggle from "@/components/theme-toggle";

export default function TopRightActionIcons() {
  return (
    <div className="absolute top-6 right-8 z-40 flex gap-2">
      <AuthButton />
      <SettingsMenu />
      <ThemeToggle />
    </div>
  );
}
