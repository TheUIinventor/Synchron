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
      content: "Basketball trials for the school team will be held on Wednesday after school in the gym.",
      category: "All",
      date: "May 9, 2025",
      isPinned: false,
    },
    {
      id: 4,
      title: "Debating Competition",
      content:
        "The inter-school debating competition will be held next Friday. All participants must attend the briefing on Tuesday.",
      category: "All",
      date: "May 8, 2025",
      isPinned: false,
    },
    {
      id: 5,
      title: "Year 7 Excursion",
      content:
        "Year 7 students will be going on an excursion to the museum on Thursday. Permission slips must be returned by Monday.",
      category: "Year 7",
      date: "May 7, 2025",
      isPinned: false,
    },
    {
      id: 6,
      title: "Year 8 Science Project",
      content: "Year 8 science projects are due next Friday. Please submit your work to your science teacher.",
      category: "Year 8",
      date: "May 6, 2025",
      isPinned: false,
    },
    {
      id: 7,
      title: "Year 9 Parent-Teacher Interviews",
      content: "Year 9 parent-teacher interviews will be held next Tuesday from 4:00 PM to 7:00 PM.",
      category: "Year 9",
      date: "May 5, 2025",
      isPinned: false,
    },
    {
      id: 8,
      title: "Year 10 Work Experience",
      content: "Year 10 work experience forms must be submitted by the end of this week.",
      category: "Year 10",
      date: "May 4, 2025",
      isPinned: false,
    },
    {
      id: 9,
      title: "Year 11 Subject Selection",
      content: "Year 11 students must complete their subject selection for next year by the end of the month.",
      category: "Year 11",
      date: "May 3, 2025",
      isPinned: false,
    },
  ]

  return (
    <PageTransition>
      <div className="container max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-gray-500 dark:text-gray-400">
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-2xl font-bold">Daily Notices</h1>
          <div className="w-6"></div> {/* Empty div for spacing */}
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">{currentDate}</p>

        <Tabs defaultValue="All" className="mb-6">
          <div className="overflow-x-auto pb-2">
            <TabsList className="inline-flex min-w-full mb-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-full">
              {categories.map((category) => (
                <TabsTrigger
                  key={category}
                  value={category}
                  className="text-xs whitespace-nowrap rounded-full data-[state=active]:bg-theme-primary data-[state=active]:text-white dark:data-[state=active]:bg-theme-primary data-[state=active]:shadow-sm transition-all duration-200"
                >
                  {category}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {categories.map((category) => (
            <TabsContent key={category} value={category}>
              <div className="space-y-2">
                {" "}
                {/* Reduced space-y from 4 to 3 */}
                {notices
                  .filter((notice) => category === "All" || notice.category === category || notice.category === "All")
                  .map((notice) => (
                    <Card
                      key={notice.id}
                      className="rounded-[1.5rem] bg-white dark:bg-gray-900 shadow-md p-4 border border-gray-100 dark:border-gray-800 backdrop-blur-md bg-opacity-90 dark:bg-opacity-90" // Reduced p-5 to p-4
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h2 className="text-lg font-semibold">{notice.title}</h2>
                        {notice.isPinned && <Pin className="h-4 w-4 text-blue-500" />}
                      </div>
                      <p className="text-sm mb-2">{notice.content}</p> {/* Reduced mb-3 to mb-2 */}
                      <div className="flex justify-between items-center">
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
                          {notice.category}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{notice.date}</span>
                      </div>
                    </Card>
                  ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </PageTransition>
  )
}
