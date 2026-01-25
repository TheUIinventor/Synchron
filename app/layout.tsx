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
        {/* Fetch userinfo FIRST before React renders anything */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (async function() {
                try {
                  const res = await fetch('/api/portal/userinfo', { 
                    method: 'GET', 
                    credentials: 'include'
                  });
                  const data = await res.json();
                  const isLoggedIn = data?.success === true;
                  sessionStorage.setItem('synchron:user-logged-in', isLoggedIn ? 'true' : 'false');
                  if (isLoggedIn && data?.data?.givenName) {
                    sessionStorage.setItem('synchron:user-name', data.data.givenName);
                  }
                  sessionStorage.setItem('synchron:userinfo-ready', 'true');
                } catch (err) {
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
