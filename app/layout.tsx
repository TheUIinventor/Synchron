<<<<<<< HEAD
import type { ReactNode } from "react"
import type { Metadata } from "next"
import { Roboto_Flex, VT323 } from "next/font/google"
import "./globals.css"
import ClientLayout from "./client-layout"

const roboto = Roboto_Flex({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto-flex",
})

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-vt323",
})
=======
import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientLayout from "./client-layout";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
>>>>>>> 5a8fbd17f6f66af4c908daa74515d0c2a0559aa0

export const metadata: Metadata = {
  title: "Synchron",
  description: "A modern, expressive timetable app for SBHS students.",
  manifest: "/manifest.json",
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
<<<<<<< HEAD
    <html lang="en" suppressHydrationWarning className={`${roboto.variable} ${vt323.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        {/* Material Symbols (Material 3 expressive icons) */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,0..200"
          rel="stylesheet"
        />
      </head>
      <body className={roboto.className}>
        <ClientLayout>{children}</ClientLayout>
=======
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased bg-background text-foreground transition-colors duration-300`}>
        <ClientLayout>
          {children}
          <Toaster />
          <SonnerToaster />
        </ClientLayout>
>>>>>>> 5a8fbd17f6f66af4c908daa74515d0c2a0559aa0
      </body>
    </html>
  );
}
