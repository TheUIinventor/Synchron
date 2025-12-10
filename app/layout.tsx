import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientLayout from "./client-layout";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Roboto_Flex } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

const roboto = Roboto_Flex({ subsets: ["latin"], display: "swap", variable: "--font-roboto-flex" });

export const metadata: Metadata = {
  title: "Synchron",
  description: "A modern, expressive timetable app for SBHS students.",
  manifest: "/manifest.json",
  openGraph: {
    siteName: "Synchron",
  },
  twitter: {
    site: "@SynchronApp",
  },
};

export const viewport: Viewport = {
  themeColor: "#6750A4", // M3 Primary
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${roboto.variable} font-sans antialiased bg-background text-foreground transition-colors duration-300`}>
        {/* Inline early-run script: attempt to unregister any old Service Worker
            and clear caches before the client bundle executes. This helps
            ensure users who are stuck on a stale/minified bundle get the
            updated assets on next load. We guard with sessionStorage so we
            don't loop reloads. */}
        <script dangerouslySetInnerHTML={{ __html: `(() => {
          try {
            if (typeof window === 'undefined') return;
            if (!('serviceWorker' in navigator)) return;
            const already = sessionStorage.getItem('synchron:sw-unregistered') === 'true';
            if (already) return;
            navigator.serviceWorker.getRegistrations().then((regs) => {
              if (regs && regs.length) {
                regs.forEach(r => { try { r.unregister(); } catch (e) {} });
                try { if (window.caches) { caches.keys().then(keys => keys.forEach(k => { try { caches.delete(k) } catch(e){} })); } } catch(e) {}
                try { sessionStorage.setItem('synchron:sw-unregistered', 'true') } catch(e) {}
                try { location.reload(); } catch(e) {}
              }
            }).catch(() => {})
          } catch (e) {}
        })();` }} />
        <ClientLayout>
          {children}
          <Toaster />
          <SonnerToaster />
          <Analytics />
        </ClientLayout>
      </body>
    </html>
  );
}
