<<<<<<< HEAD
import type { ReactNode } from "react"
import type { Metadata } from "next"
import { Roboto_Flex, VT323 } from "next/font/google"
import "./globals.css"
import ClientLayout from "./client-layout"
=======
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Roboto_Flex, VT323 } from "next/font/google";
import "./globals.css";
import ClientLayout from "./client-layout";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
>>>>>>> e56f7483f26373761f5c7c60f3713de4c9c5ecdd

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
<<<<<<< HEAD
})
=======
});


>>>>>>> e56f7483f26373761f5c7c60f3713de4c9c5ecdd

export const metadata: Metadata = {
  title: "Synchron",
  description: "Built For Sydney Boys High School",
    generator: 'v0.dev'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
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
      </body>
    </html>
  )
}
