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
        {/* Emergency inline script: run as early as possible to unregister any active
            service workers and clear caches. This helps clients stuck on an older
            service-worker-controlled bundle recover and load the new fixed assets.
            Keep this temporary and remove after users have migrated. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{if(typeof sessionStorage!=='undefined'&&sessionStorage.getItem('synchron:panic-cleared')==='true')return;var p=false;function mark(){try{sessionStorage.setItem('synchron:panic-cleared','true')}catch(e){}}if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(regs){Promise.all(regs.map(function(r){try{return r.unregister();}catch(e){return Promise.resolve(false);} })).finally(function(){mark();try{if('caches' in window){caches.keys().then(function(keys){return Promise.all(keys.map(function(k){return caches.delete(k);}));}).finally(function(){location.reload(true);});}else{location.reload(true);}}catch(e){location.reload(true);}});}).catch(function(){try{mark();location.reload(true);}catch(e){}});}else{try{mark();if('caches' in window){caches.keys().then(function(keys){return Promise.all(keys.map(function(k){return caches.delete(k);}));}).finally(function(){location.reload(true);});}else{location.reload(true);}}catch(e){}}}catch(e){} })()` }} />
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
