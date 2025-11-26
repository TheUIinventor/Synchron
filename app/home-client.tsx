"use client";

import { useTimetable } from "@/contexts/timetable-context";
import { format } from "date-fns";
import { Loader2, Bell, MapPin, Calendar, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function HomeClient() {
  const { 
    timetableData, 
    currentMomentPeriodInfo, 
    isLoading, 
    error, 
    refreshExternal,
    selectedDay
  } = useTimetable();
  
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  if (isLoading || !currentDate) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          <p className="text-muted-foreground animate-pulse font-medium">Syncing...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
        <div className="w-24 h-24 rounded-3xl bg-destructive/10 flex items-center justify-center mb-4">
          <Loader2 className="h-10 w-10 text-destructive animate-spin" />
        </div>
        <h2 className="text-2xl font-serif text-destructive">Connection Error</h2>
        <p className="text-muted-foreground max-w-xs">{error}</p>
        <button 
          onClick={() => refreshExternal && refreshExternal()} 
          className="px-6 py-3 rounded-full bg-primary text-primary-foreground hover:shadow-lg transition-all active:scale-95"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { currentPeriod, nextPeriod, timeUntil } = currentMomentPeriodInfo;
  
  // Get today's periods for the sidebar
  // Use selectedDay if available, otherwise fallback to current day name
  const dayName = selectedDay || format(currentDate, "EEEE");
  const todaysPeriods = timetableData[dayName] || [];

  return (
    <div className="space-y-6 pb-24 md:pb-8 animate-in fade-in duration-700">
      
      {/* Header Section */}
      <div className="flex flex-col gap-1 pt-4 md:pt-0">
        <h1 className="text-4xl md:text-5xl font-serif text-foreground">
          {format(currentDate, "EEEE")}
        </h1>
        <p className="text-lg text-muted-foreground font-medium">
          {format(currentDate, "MMMM do")}
        </p>
      </div>

      {/* Main Expressive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
        
        {/* HERO: Current/Next Period - Spans full width on mobile, 8 cols on desktop */}
        <div className="md:col-span-8 space-y-4">
            
            {/* Primary Status Card */}
            <div className="relative overflow-hidden rounded-m3-2xl bg-primary-container text-primary-container-foreground p-6 md:p-8 shadow-elevation-1 hover:shadow-elevation-2 transition-all duration-500 ease-expressive hover:scale-[1.01] group">
              {/* Background Blob */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-primary/20" />
              
              <div className="relative z-10 flex flex-col h-full justify-between min-h-[200px]">
                <div className="flex justify-between items-start">
                  <Badge variant="secondary" className="bg-primary/20 text-primary-container-foreground hover:bg-primary/30 rounded-full px-4 py-1 text-sm font-medium">
                    Now
                  </Badge>
                  <MapPin className="h-6 w-6 opacity-60" />
                </div>
                
                <div className="mt-4">
                  <h2 className="text-4xl md:text-6xl font-serif leading-tight mb-2">
                    {currentPeriod?.subject || "Free Period"}
                  </h2>
                  <div className="flex items-center gap-3 text-lg opacity-80 font-medium">
                    <span className="bg-primary-foreground/20 px-3 py-1 rounded-md">
                      {currentPeriod?.room || "Campus"}
                    </span>
                    <span>•</span>
                    <span>{currentPeriod?.teacher || "Self Study"}</span>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="h-2 w-full bg-primary/20 rounded-full overflow-hidden">
                    {/* Progress bar could be calculated based on time */}
                    <div className="h-full bg-primary w-[45%] rounded-full" />
                  </div>
                  <div className="flex justify-between text-sm mt-2 font-medium opacity-70">
                    <span>{currentPeriod?.time?.split(' - ')[0] || "Now"}</span>
                    <span>{currentPeriod?.time?.split(' - ')[1] || "Later"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Next Up Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="rounded-m3-xl bg-surface-container-high p-6 flex flex-col justify-between hover:bg-surface-variant transition-colors duration-300">
                  <div className="flex items-center gap-2 text-muted-foreground mb-4">
                    <ArrowRight className="h-5 w-5" />
                    <span className="font-medium">Up Next {timeUntil && `(${timeUntil})`}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">{nextPeriod?.subject || "End of Day"}</h3>
                    <p className="text-muted-foreground">{nextPeriod?.room || "Home"}</p>
                  </div>
               </div>

               <Link href="/notices" className="rounded-m3-xl bg-tertiary-container text-tertiary-container-foreground p-6 flex flex-col justify-between hover:brightness-95 transition-all cursor-pointer">
                  <div className="flex items-center gap-2 mb-4 opacity-80">
                    <Bell className="h-5 w-5" />
                    <span className="font-medium">Notices</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <h3 className="text-3xl font-serif">View</h3>
                      <p className="text-sm font-medium opacity-80">Daily Notices</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-tertiary/20 flex items-center justify-center">
                        <ArrowRight className="h-5 w-5" />
                    </div>
                  </div>
               </Link>
            </div>
        </div>

        {/* SIDEBAR: Date & Quick Actions - 4 cols on desktop */}
        <div className="md:col-span-4 space-y-4">
            <div className="rounded-m3-xl bg-surface-container p-6 h-full min-h-[300px] flex flex-col">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    {dayName}
                </h3>
                
                <div className="space-y-4 flex-1 overflow-y-auto max-h-[400px] pr-2">
                    {todaysPeriods.length > 0 ? (
                      todaysPeriods.map((period, i) => (
                          <div key={i} className="flex gap-4 items-center group cursor-pointer">
                              <div className="flex flex-col items-center min-w-[3rem]">
                                  <span className="text-xs font-bold text-muted-foreground">{period.time.split(' - ')[0]}</span>
                              </div>
                              <div className={cn(
                                "flex-1 p-3 rounded-xl border transition-all shadow-sm",
                                period.subject === currentPeriod?.subject 
                                  ? "bg-primary-container border-primary/20" 
                                  : "bg-surface hover:bg-white dark:hover:bg-zinc-800 border-transparent hover:border-border"
                              )}>
                                  <p className="font-medium text-sm">{period.subject}</p>
                                  <p className="text-xs text-muted-foreground">{period.room}</p>
                              </div>
                          </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-8">No classes today</p>
                    )}
                </div>
                
                <Link href="/timetable" className="mt-6 w-full py-3 rounded-full border border-outline text-center text-sm font-medium hover:bg-surface-variant transition-colors">
                    View Full Week
                </Link>
            </div>
        </div>
      </div>
    </div>
  );
}
