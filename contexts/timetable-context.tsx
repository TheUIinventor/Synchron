"use client"

import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from "react"
import { getTimeUntilNextPeriod, isSchoolDayOver, getNextSchoolDay, getCurrentDay } from "@/utils/time-utils"

// Define the period type
export type Period = {
  id: number
  period: string
  time: string
  subject: string
  teacher: string
  room: string
}

// Define the bell time type
export type BellTime = {
  period: string
  time: string
}

// Define the timetable context type
type TimetableContextType = {
  currentWeek: "A" | "B"
  setCurrentWeek: (week: "A" | "B") => void
  selectedDay: string // Day for the main timetable display (e.g., "Monday")
  selectedDateObject: Date // The actual Date object for the selectedDay
  setSelectedDay: (day: string) => void
  timetableData: Record<string, Period[]>
  currentMomentPeriodInfo: {
    // Renamed from nextPeriodInfo to be clearer
    nextPeriod: Period | null
    timeUntil: string
    isCurrentlyInClass: boolean
    currentPeriod: Period | null
  }
  bellTimes: Record<string, BellTime[]>
  isShowingNextDay: boolean // Indicates if the main timetable is showing next day
}

// Create the context
const TimetableContext = createContext<TimetableContextType | undefined>(undefined)

// Updated bell times for different day groups
const bellTimesData = {
  "Mon/Tues": [
    { period: "Period 1", time: "9:00 - 10:05" },
    { period: "Period 2", time: "10:05 - 11:05" },
    { period: "Recess", time: "11:05 - 11:25" },
    { period: "Period 3", time: "11:25 - 12:30" },
    { period: "Period 4", time: "12:30 - 1:30" },
    { period: "Lunch 1", time: "1:30 - 1:50" },
    { period: "Lunch 2", time: "1:50 - 2:10" },
    { period: "Period 5", time: "2:10 - 3:10" },
    { period: "End of Day", time: "3:10" },
  ],
  "Wed/Thurs": [
    { period: "Period 1", time: "9:00 - 10:05" },
    { period: "Period 2", time: "10:05 - 11:05" },
    { period: "Recess", time: "11:05 - 11:25" },
    { period: "Period 3", time: "11:25 - 12:25" },
    { period: "Lunch 1", time: "12:25 - 12:45" },
    { period: "Lunch 2", time: "12:45 - 1:05" },
    { period: "Period 4", time: "1:05 - 2:10" },
    { period: "Period 5", time: "2:10 - 3:10" },
    { period: "End of Day", time: "3:10" },
  ],
  Fri: [
    { period: "Period 1", time: "9:25 - 10:20" },
    { period: "Period 2", time: "10:20 - 11:10" },
    { period: "Recess", time: "11:10 - 11:40" },
    { period: "Period 3", time: "11:40 - 12:35" },
    { period: "Lunch 1", time: "12:35 - 12:55" },
    { period: "Lunch 2", time: "12:55 - 1:15" },
    { period: "Period 4", time: "1:15 - 2:15" },
    { period: "Period 5", time: "2:15 - 3:10" },
    { period: "End of Day", time: "3:10" },
  ],
}

// Mock data for the timetable - memoized
const timetableWeekA = {
  Monday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "English", teacher: "Ms. Smith", room: "301" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "Mathematics", teacher: "Mr. Johnson", room: "304" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:30", subject: "Science", teacher: "Dr. Williams", room: "Lab 2" },
    { id: 5, period: "4", time: "12:30 - 1:30", subject: "History", teacher: "Mr. Brown", room: "205" },
    { id: 6, period: "Lunch 1", time: "1:30 - 1:50", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "Lunch 2", time: "1:50 - 2:10", subject: "Break", teacher: "", room: "" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "PE", teacher: "Mr. Davis", room: "Gym" },
  ],
  Tuesday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "Mathematics", teacher: "Mr. Johnson", room: "304" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "Science", teacher: "Dr. Williams", room: "Lab 2" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:30", subject: "English", teacher: "Ms. Smith", room: "301" },
    { id: 5, period: "4", time: "12:30 - 1:30", subject: "Geography", teacher: "Ms. Taylor", room: "207" },
    { id: 6, period: "Lunch 1", time: "1:30 - 1:50", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "Lunch 2", time: "1:50 - 2:10", subject: "Break", teacher: "", room: "" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "Music", teacher: "Mr. Anderson", room: "Music Room" },
  ],
  Wednesday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "History", teacher: "Mr. Brown", room: "205" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "English", teacher: "Ms. Smith", room: "301" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:25", subject: "Mathematics", teacher: "Mr. Johnson", room: "304" },
    { id: 5, period: "Lunch 1", time: "12:25 - 12:45", subject: "Break", teacher: "", room: "" },
    { id: 6, period: "Lunch 2", time: "12:45 - 1:05", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "4", time: "1:05 - 2:10", subject: "Science", teacher: "Dr. Williams", room: "Lab 2" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "Geography", teacher: "Ms. Taylor", room: "207" },
  ],
  Thursday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "Science", teacher: "Dr. Williams", room: "Lab 2" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "History", teacher: "Mr. Brown", room: "205" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:25", subject: "Geography", teacher: "Ms. Taylor", room: "207" },
    { id: 5, period: "Lunch 1", time: "12:25 - 12:45", subject: "Break", teacher: "", room: "" },
    { id: 6, period: "Lunch 2", time: "12:45 - 1:05", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "4", time: "1:05 - 2:10", subject: "English", teacher: "Ms. Smith", room: "301" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "Computing", teacher: "Ms. Lee", room: "Computer Lab" },
  ],
  Friday: [
    { id: 1, period: "1", time: "9:25 - 10:20", subject: "PE", teacher: "Mr. Davis", room: "Gym" },
    { id: 2, period: "2", time: "10:20 - 11:10", subject: "Computing", teacher: "Ms. Lee", room: "Computer Lab" },
    { id: 3, period: "Recess", time: "11:10 - 11:40", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:40 - 12:35", subject: "Music", teacher: "Mr. Anderson", room: "Music Room" },
    { id: 5, period: "Lunch 1", time: "12:35 - 12:55", subject: "Break", teacher: "", room: "" },
    { id: 6, period: "Lunch 2", time: "12:55 - 1:15", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "4", time: "1:15 - 2:15", subject: "Mathematics", teacher: "Mr. Johnson", room: "304" },
    { id: 8, period: "5", time: "2:15 - 3:10", subject: "Art", teacher: "Ms. Wilson", room: "Art Studio" },
  ],
}

const timetableWeekB = {
  Monday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "Geography", teacher: "Ms. Taylor", room: "207" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "Art", teacher: "Ms. Wilson", room: "Art Studio" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:30", subject: "Computing", teacher: "Ms. Lee", room: "Computer Lab" },
    { id: 5, period: "4", time: "12:30 - 1:30", subject: "PE", teacher: "Mr. Davis", room: "Gym" },
    { id: 6, period: "Lunch 1", time: "1:30 - 1:50", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "Lunch 2", time: "1:50 - 2:10", subject: "Break", teacher: "", room: "" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "Mathematics", teacher: "Mr. Johnson", room: "304" },
  ],
  Tuesday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "Music", teacher: "Mr. Anderson", room: "Music Room" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "PE", teacher: "Mr. Davis", room: "Gym" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:30", subject: "Art", teacher: "Ms. Wilson", room: "Art Studio" },
    { id: 5, period: "4", time: "12:30 - 1:30", subject: "Science", teacher: "Dr. Williams", room: "Lab 2" },
    { id: 6, period: "Lunch 1", time: "1:30 - 1:50", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "Lunch 2", time: "1:50 - 2:10", subject: "Break", teacher: "", room: "" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "History", teacher: "Mr. Brown", room: "205" },
  ],
  Wednesday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "Computing", teacher: "Ms. Lee", room: "Computer Lab" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "Music", teacher: "Mr. Anderson", room: "Music Room" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:25", subject: "PE", teacher: "Mr. Davis", room: "Gym" },
    { id: 5, period: "Lunch 1", time: "12:25 - 12:45", subject: "Break", teacher: "", room: "" },
    { id: 6, period: "Lunch 2", time: "12:45 - 1:05", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "4", time: "1:05 - 2:10", subject: "Art", teacher: "Ms. Wilson", room: "Art Studio" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "English", teacher: "Ms. Smith", room: "301" },
  ],
  Thursday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "English", teacher: "Ms. Smith", room: "301" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "Geography", teacher: "Ms. Taylor", room: "207" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:25", subject: "History", teacher: "Mr. Brown", room: "205" },
    { id: 5, period: "Lunch 1", time: "12:25 - 12:45", subject: "Break", teacher: "", room: "" },
    { id: 6, period: "Lunch 2", time: "12:45 - 1:05", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "4", time: "1:05 - 2:10", subject: "Computing", teacher: "Ms. Lee", room: "Computer Lab" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "Science", teacher: "Dr. Williams", room: "Lab 2" },
  ],
  Friday: [
    { id: 1, period: "1", time: "9:25 - 10:20", subject: "Mathematics", teacher: "Mr. Johnson", room: "304" },
    { id: 2, period: "2", time: "10:20 - 11:10", subject: "History", teacher: "Mr. Brown", room: "205" },
    { id: 3, period: "Recess", time: "11:10 - 11:40", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:40 - 12:35", subject: "Science", teacher: "Dr. Williams", room: "Lab 2" },
    { id: 5, period: "Lunch 1", time: "12:35 - 12:55", subject: "Break", teacher: "", room: "" },
    { id: 6, period: "Lunch 2", time: "12:55 - 1:15", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "4", time: "1:15 - 2:15", subject: "Music", teacher: "Mr. Anderson", room: "Music Room" },
    { id: 8, period: "5", time: "2:15 - 3:10", subject: "Geography", teacher: "Ms. Taylor", room: "207" },
  ],
}

// Create the provider component
export function TimetableProvider({ children }: { children: ReactNode }) {
  const [currentWeek, setCurrentWeek] = useState<"A" | "B">("A")
  const [selectedDay, setSelectedDay] = useState<string>("") // Day for main timetable
  const [selectedDateObject, setSelectedDateObject] = useState<Date>(new Date()) // Date object for selectedDay
  const [isShowingNextDay, setIsShowingNextDay] = useState(false) // For main timetable
  const [currentMomentPeriodInfo, setCurrentMomentPeriodInfo] = useState({
    // For header status
    nextPeriod: null as Period | null,
    timeUntil: "",
    isCurrentlyInClass: false,
    currentPeriod: null as Period | null,
  })

  // Memoize the current timetable based on selected week
  const timetableData = useMemo(() => {
    return currentWeek === "A" ? timetableWeekA : timetableWeekB
  }, [currentWeek])

  // Function to update all relevant time-based states
  const updateAllTimeStates = useCallback(() => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    const now = new Date()

    // 1. Determine day for main timetable display
    let dayForMainTimetable = now
    let showingNextDayFlag = false
    if (isSchoolDayOver()) {
      dayForMainTimetable = getNextSchoolDay(now)
      showingNextDayFlag = true
    }
    const mainTimetableDayName = days[dayForMainTimetable.getDay()]
    setSelectedDay(
      mainTimetableDayName === "Sunday" || mainTimetableDayName === "Saturday" ? "Monday" : mainTimetableDayName,
    )
    setSelectedDateObject(dayForMainTimetable) // Set the actual Date object
    setIsShowingNextDay(showingNextDayFlag)

    // 2. Calculate current moment's period info (always based on actual current day)
    const actualCurrentDayName = getCurrentDay() // Use getCurrentDay for the actual day
    if (actualCurrentDayName !== "Sunday" && actualCurrentDayName !== "Saturday") {
      const actualTodayTimetable = timetableData[actualCurrentDayName]
      const info = getTimeUntilNextPeriod(actualTodayTimetable)
      setCurrentMomentPeriodInfo(info)
    } else {
      setCurrentMomentPeriodInfo({
        nextPeriod: null,
        timeUntil: "No classes",
        isCurrentlyInClass: false,
        currentPeriod: null,
      })
    }
  }, [timetableData]) // timetableData is a dependency because it's used to get actualTodayTimetable

  // Initial update and 1-second interval for all time-based states
  useEffect(() => {
    updateAllTimeStates()
    const interval = setInterval(updateAllTimeStates, 1000)
    return () => clearInterval(interval)
  }, [updateAllTimeStates])

  return (
    <TimetableContext.Provider
      value={{
        currentWeek,
        setCurrentWeek,
        selectedDay,
        selectedDateObject, // Provide the new state
        setSelectedDay,
        timetableData,
        currentMomentPeriodInfo, // Provide the new state
        bellTimes: bellTimesData,
        isShowingNextDay,
      }}
    >
      {children}
    </TimetableContext.Provider>
  )
}

// Create a hook to use the timetable context
export function useTimetable() {
  const context = useContext(TimetableContext)
  if (context === undefined) {
    throw new Error("useTimetable must be used within a TimetableProvider")
  }
  return context
}
