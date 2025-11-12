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
  const [topPx, setTopPx] = useState<number | null>(null)
  const [rightPx, setRightPx] = useState<number | null>(null)
  const rafRef = useRef<number | null>(null)

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

  // Compute top so the FAB is vertically centered inside the first header element
  useEffect(() => {
    function computeTop() {
      const header = document.querySelector("header");
      if (!header) {
        setTopPx(null);
        setRightPx(null);
        return;
      }
      const rect = header.getBoundingClientRect();
      const fabPx = 48; // w-12 = 3rem = 48px
      // For a fixed element top is relative to the viewport, so use rect.top
      const top = rect.top + rect.height / 2 - fabPx / 2;
      // right offset so the FAB sits inside the header's right padding (min 12px)
      const right = Math.max(12, Math.round(window.innerWidth - rect.right + 16));
      setTopPx(Math.max(8, Math.round(top)));
      setRightPx(right);
    }

    function onResizeOrScroll() {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(computeTop);
    }

    // compute initially and subscribe to events
    computeTop();
    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, { passive: true });
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll as any);
    };
  }, []);

  if (!isMobile) return null;

  // Always provide a top and right value: center in header when computed, otherwise fall back to sensible defaults
  const style = { top: `${topPx ?? 24}px`, right: `${rightPx ?? 24}px` }

  return (
    <div ref={containerRef} style={style} className="fixed z-50" aria-hidden={false}>
      <div className="relative">
        {/* FAB button (closed) */}
        <button
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className={`${size} aspect-square rounded-full overflow-hidden glass glass-border shadow flex items-center justify-center transition-transform duration-100 ease-out`}
          onPointerDown={(e) => { e.preventDefault(); setOpen((v) => !v); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(v => !v); } }}
        >
          <div className="w-full h-full flex items-center justify-center">
            {open ? (
              <span className="material-symbols-rounded" style={{ fontSize: 20 }} aria-hidden>close</span>
            ) : (
              <span className="material-symbols-rounded" style={{ fontSize: 20 }} aria-hidden>menu</span>
            )}
          </div>
        </button>

        {/* Expanded menu */}
        {open && (
          <div className="absolute right-0 mt-2 w-48 glass glass-border rounded-xl shadow-lg overflow-hidden transition-transform duration-150 ease-out transform scale-95">
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
