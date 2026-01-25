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
        {/* Fetch timetable FIRST before React renders anything - checks auth faster */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (async function() {
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
                  console.log('[head-script] Cache updated, ready flag set');
                } catch (err) {
                  console.error('[head-script] Error:', err);
                  sessionStorage.setItem('synchron:user-logged-in', 'false');
                  sessionStorage.setItem('synchron:userinfo-ready', 'true');
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
