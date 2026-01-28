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
  appleWebApp: {
    title: "Synchron",
  },
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
      <head>
        {/* Instrumentation: log every sessionStorage.setItem call to trace overwrites */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  const originalSet = sessionStorage.setItem.bind(sessionStorage);
                  sessionStorage.setItem = function(k, v) {
                    try {
                      console.log('[sessionStorage.setItem] key=' + k + ' value=' + v);
                      console.log(new Error().stack);
                    } catch(e){}
                    return originalSet(k, v);
                  };
                  console.log('[head-instrument] sessionStorage.setItem wrapped');
                } catch(e) {
                  console.error('[head-instrument] failed to wrap sessionStorage.setItem', e);
                }
              })();
            `,
          }}
        />

        {/* CRITICAL: Check for OAuth callback FIRST - must run synchronously before anything else */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Check if we just completed OAuth - auth_success=true in URL
              // Run synchronously to set cache BEFORE React hydrates
              const urlParams = new URLSearchParams(window.location.search);
              if (urlParams.get('auth_success') === 'true') {
                console.log('[head-script] OAuth callback detected, setting auth to true IMMEDIATELY');
                sessionStorage.setItem('synchron:user-logged-in', 'true');
                sessionStorage.setItem('synchron:userinfo-ready', 'true');
                try { window.dispatchEvent(new CustomEvent('synchron:userinfo-ready')) } catch (e) {}
                // Clean up URL without waiting
                window.history.replaceState({}, document.title, window.location.pathname);
              }
            `,
          }}
        />
        {/* Fetch timetable for auth check - only if OAuth flag not found */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (async function() {
                // Skip if already set by OAuth callback
                if (sessionStorage.getItem('synchron:userinfo-ready') === 'true') {
                  console.log('[head-script] Auth already set by OAuth, skipping timetable fetch');
                  return;
                }
                
                const start = Date.now();
                
                // Get today's date in YYYY/MM/DD format
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const dateStr = year + '/' + month + '/' + day;
                
                console.log('[head-script] Starting timetable auth check for ' + dateStr);
                try {
                  const res = await fetch('/api/timetable?date=' + dateStr, { 
                    method: 'GET', 
                    credentials: 'include'
                  });
                  const data = await res.json();
                  
                  // Check if authenticated by looking for "Unauthorized" error
                  const isLoggedIn = !(data?.upstream?.day?.message === 'Unauthorized');
                  console.log('[head-script] Response received after', Date.now() - start, 'ms:', isLoggedIn);
                  
                  sessionStorage.setItem('synchron:user-logged-in', isLoggedIn ? 'true' : 'false');
                  sessionStorage.setItem('synchron:userinfo-ready', 'true');
                  try { window.dispatchEvent(new CustomEvent('synchron:userinfo-ready')) } catch (e) {}
                  console.log('[head-script] Cache updated, ready flag set');
                } catch (err) {
                  console.error('[head-script] Error:', err);
                  sessionStorage.setItem('synchron:user-logged-in', 'false');
                  sessionStorage.setItem('synchron:userinfo-ready', 'true');
                  try { window.dispatchEvent(new CustomEvent('synchron:userinfo-ready')) } catch (e) {}
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${roboto.variable} font-sans antialiased bg-background text-foreground transition-colors duration-300`}>
        {/* Emergency inline recovery script removed — caused reload loops and
          blocked client navigation. If emergency unregister is needed,
          enable it manually by setting `sessionStorage['synchron:panic-cleared']=true`
          or reintroducing a controlled script. */}
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
