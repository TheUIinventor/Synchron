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
        <Link href="/" className="inline-flex items-center gap-2 mb-4 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ChevronLeft size={18} /> Back to Home
        </Link>
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All Notices</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <div className="mt-4">
              <NoticesClient />
            </div>
          </TabsContent>
        </Tabs>
      </PageTransition>
    </>
  );
// ...existing code above...
}
