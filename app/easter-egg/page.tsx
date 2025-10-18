"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ChevronLeft, Leaf } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import PageTransition from "@/components/page-transition"

// Helper function to format date as YYYY-MM-DD
const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  return `${year}-${month}-${day}`
}

export default function EasterEggPage() {
  const [grassTouchedCount, setGrassTouchedCount] = useState(0)
  const [lastTouchedDate, setLastTouchedDate] = useState<string | null>(null)

  useEffect(() => {
    const savedData = localStorage.getItem("synchron-grass-touched-data")
    const today = formatDateToYYYYMMDD(new Date())

    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData)
        if (parsedData.lastTouchedDate === today) {
          setGrassTouchedCount(parsedData.count)
          setLastTouchedDate(parsedData.lastTouchedDate)
        } else {
          // New day, reset count
          setGrassTouchedCount(0)
          setLastTouchedDate(today)
          localStorage.setItem("synchron-grass-touched-data", JSON.stringify({ count: 0, lastTouchedDate: today }))
        }
      } catch (error) {
        console.error("Failed to parse grass touched data from localStorage", error)
        // Fallback to default if parsing fails
        setGrassTouchedCount(0)
        setLastTouchedDate(today)
        localStorage.setItem("synchron-grass-touched-data", JSON.stringify({ count: 0, lastTouchedDate: today }))
      }
    } else {
      // No data found, initialize
      setGrassTouchedCount(0)
      setLastTouchedDate(today)
      localStorage.setItem("synchron-grass-touched-data", JSON.stringify({ count: 0, lastTouchedDate: today }))
    }
  }, [])

  const handleTouchGrass = useCallback(() => {
    setGrassTouchedCount((prevCount) => {
      const newCount = prevCount + 1
      const today = formatDateToYYYYMMDD(new Date())
      localStorage.setItem("synchron-grass-touched-data", JSON.stringify({ count: newCount, lastTouchedDate: today }))
      setLastTouchedDate(today) // Ensure state is updated
      return newCount
    })
  }, [])

  return (
    <PageTransition>
      <div className="container max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4 md:mb-6 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 w-full">
          <Link href="/settings" className="hidden md:flex text-gray-500 dark:text-gray-400">
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-lg font-bold text-left md:text-center md:flex-1">Easter Egg</h1>
          <div className="w-6"></div>
        </div>

        <Card className="card-optimized-main text-center p-6">
          <CardContent className="p-0">
            <div className="flex flex-col items-center justify-center mb-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <Leaf className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-3xl font-bold theme-gradient mb-2">Touched Grass Lately?</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Keep track of your outdoor adventures!</p>
            </div>

            <div className="mb-6">
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">You've touched grass</p>
              <p className="text-6xl font-bold theme-gradient tabular-nums">{grassTouchedCount}</p>
              <p className="text-lg text-gray-600 dark:text-gray-300 mt-2">
                time{grassTouchedCount !== 1 ? "s" : ""} today!
              </p>
            </div>

            <Button onClick={handleTouchGrass} className="w-full one-ui-button">
              <Leaf className="h-5 w-5 mr-2" />I Touched Grass!
            </Button>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">(Count resets daily)</p>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  )
}
