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
          <div className="container max-w-2xl mx-auto px-4">
            <div className="px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 w-full mb-4">
              <h1 className="text-lg font-bold text-left md:text-center w-full">Notices</h1>
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
