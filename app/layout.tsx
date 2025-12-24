import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientLayout from "./client-layout";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Roboto_Flex } from "next/font/google";
// Analytics removed temporarily for build troubleshooting

const roboto = Roboto_Flex({ subsets: ["latin"], display: "swap", variable: "--font-roboto-flex" });

export const dynamic = "force-dynamic"

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
        {/* Emergency inline recovery script removed — caused reload loops and
          blocked client navigation. If emergency unregister is needed,
          enable it manually by setting `sessionStorage['synchron:panic-cleared']=true`
          or reintroducing a controlled script. */}
        <ClientLayout>
          {children}
          <Toaster />
          <SonnerToaster />
        </ClientLayout>
      </body>
    </html>
  );
}
