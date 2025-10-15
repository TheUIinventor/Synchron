"use client";
import { useEffect, useState } from "react";

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showButton, setShowButton] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Listen for beforeinstallprompt event (Chrome, Edge, Android)
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowButton(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Listen for appinstalled event
    window.addEventListener('appinstalled', () => {
      setInstalled(true);
      setShowButton(false);
    });

    // iOS Safari: check for standalone mode
    if (typeof window !== 'undefined') {
      const nav: any = window.navigator;
      if (typeof nav.standalone !== 'undefined' && nav.standalone === false) {
        // Show button for iOS Safari if not installed
        const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
        const isSafari = /^((?!chrome|android).)*safari/i.test(window.navigator.userAgent);
        if (isIOS && isSafari) {
          setShowButton(true);
        }
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowButton(false);
      }
    } else {
      // iOS Safari instructions
      alert('To install this app, tap the Share button in Safari and select "Add to Home Screen".');
    }
  };

  if (!showButton || installed) return null;

  return (
    <button
      onClick={handleInstall}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full font-semibold shadow-lg bg-blue-600 text-white hover:bg-blue-700 transition-all text-base sm:text-lg"
      style={{
        background: 'var(--theme-primary-fg, #2563eb)',
        color: 'var(--theme-primary-bg, #dbeafe)',
      }}
    >
      <span role="img" aria-label="install">📲</span> Install App
    </button>
  );
}
