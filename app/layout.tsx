import type { Metadata, Viewport } from "next";
import { Roboto_Flex, Roboto_Serif } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const robotoFlex = Roboto_Flex({ 
  subsets: ["latin"],
  variable: "--font-roboto-flex",
  display: 'swap',
  axes: ['GRAD', 'XTRA', 'YOPQ'] // Expressive variable axes
});

const robotoSerif = Roboto_Serif({ 
  subsets: ["latin"],
  variable: "--font-roboto-serif",
  display: 'swap'
});

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
    <html lang="en" suppressHydrationWarning>
      <body className={`${robotoFlex.variable} ${robotoSerif.variable} font-sans antialiased bg-background text-foreground transition-colors duration-300`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <SonnerToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
