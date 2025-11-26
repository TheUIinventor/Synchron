"use client";

import { useEffect, useState } from "react";
import { Bagel_Fat_One } from "next/font/google";
import { useTimetable } from "@/contexts/timetable-context";
import { format } from "date-fns";
import Link from "next/link";
import { Loader2, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthButton } from "@/components/auth-button";
import ThemeToggle from "@/components/theme-toggle";
import SettingsMenu from "@/components/settings-menu";
import { cn } from "@/lib/utils";

const bagel = Bagel_Fat_One({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-bagel-fat-one",
});

export default function HomeClient() {
  const { timetableData, currentMomentPeriodInfo, isLoading, error, refreshExternal, selectedDay } = useTimetable();

  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  useEffect(() => setCurrentDate(new Date()), []);

  const { currentPeriod, nextPeriod, timeUntil } = currentMomentPeriodInfo || {};
  const dayName = selectedDay || (currentDate ? format(currentDate, "EEEE") : "");
  const todaysPeriods = timetableData?.[dayName] || [];

  if (isLoading || !currentDate) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        "use client";

        import { Bagel_Fat_One } from "next/font/google";

        const bagel = Bagel_Fat_One({ weight: "400", subsets: ["latin"], display: "swap", variable: "--font-bagel-fat-one" });

        export default function HomeClient() {
          return (
            <main className="p-8">
              <h1 className={`${bagel.className} text-5xl`}>Synchron</h1>
              <p className="text-muted-foreground mt-2">Your school day at a glance</p>
            </main>
          );
        }
        <h2 className="text-2xl font-serif text-destructive">Connection Error</h2>
