"use client";

import { AuthButton } from "@/components/auth-button";
import SettingsMenu from "@/components/settings-menu";
import ThemeToggle from "@/components/theme-toggle";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/api/hooks";
import { Menu, X } from "lucide-react";

// Mobile-only floating action button that expands into a small rounded menu.
export default function TopRightActionIcons() {
  const size = "w-12"; // closed FAB size (mobile only) - slightly larger for touch

  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    function update() {
      setIsMobile(typeof window !== "undefined" ? window.innerWidth < 768 : false);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Close on Escape and click outside
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (e.target instanceof Node && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onDocClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onDocClick);
    };
  }, []);

  if (!isMobile) return null;

  return (
    <div ref={containerRef} className="fixed top-6 right-6 z-50">
      <div className="relative">
        {/* FAB button (closed) */}
        <button
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className={`${size} aspect-square rounded-full overflow-hidden bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow flex items-center justify-center border border-gray-200 dark:border-gray-800 liquid-glass liquid-bob transition-transform duration-100 ease-out`}
          onPointerDown={(e) => { e.preventDefault(); setOpen((v) => !v); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(v => !v); } }}
        >
          <div className="w-full h-full flex items-center justify-center">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </div>
        </button>

        {/* Expanded menu */}
        {open && (
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900/95 backdrop-blur-sm border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg overflow-hidden liquid-glass transition-transform duration-150 ease-out transform scale-95">
            <div className="p-2 space-y-1">
              <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-100">
                <div className="w-9 h-9 rounded-full bg-theme-secondary/10 dark:bg-theme-secondary/10 flex items-center justify-center">
                  <div className="icon-optimized text-theme-primary">
                    <ThemeToggle />
                  </div>
                </div>
                <div className="flex-1 text-sm">Theme</div>
              </div>

              <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-100">
                <div className="w-9 h-9 rounded-full bg-theme-secondary/10 dark:bg-theme-secondary/10 flex items-center justify-center">
                  <div className="glass-icon-enhanced rounded-full p-1">
                    <SettingsMenu />
                  </div>
                </div>
                <div className="flex-1 text-sm">Settings</div>
              </div>

              <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-100">
                <div className="w-9 h-9 rounded-full bg-theme-secondary/10 dark:bg-theme-secondary/10 flex items-center justify-center">
                  <div className="rounded-full p-1">
                    <AuthButton />
                  </div>
                </div>
                <div className="flex-1 text-sm">{isAuthenticated ? "Log out" : "Log in"}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
