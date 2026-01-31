"use client"

import { useEffect } from "react"
import NoticesClient from "./notices-client"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { ChevronLeft, Pin } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { trackSectionUsage } from "@/utils/usage-tracker"
import PageTransition from "@/components/page-transition"

export default function NoticesPage() {
  return (
    <>
      <PageTransition>
        <div className="flex flex-col items-start w-full mt-4">
          <div className="container max-w-6xl mx-auto px-4">
            <div className="flex items-center justify-between mb-6 px-4 py-2 w-full">
              <Link href="/" className="hidden md:flex text-on-surface-variant hover:text-on-surface transition-colors">
                <ChevronLeft className="h-6 w-6" />
              </Link>
              <h1 className="text-3xl font-semibold text-on-surface text-left md:text-center md:flex-1">Notices</h1>
              <div className="w-6 hidden md:block" />
            </div>
            <div className="w-full flex flex-col items-center">
              <NoticesClient />
            </div>
          </div>
        </div>
      </PageTransition>
    </>
  );
// ...existing code above...
}
