"use client"

import type React from "react"

import { useEffect } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronLeft, Award, TrendingUp, Medal, Trophy, Star, Download } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { trackSectionUsage } from "@/utils/usage-tracker"
import PageTransition from "@/components/page-transition"
import { useUserSettings } from "@/components/theme-provider" // Import useUserSettings
import { useParticipation, useAwardPoints } from "@/lib/api/hooks"
import { cn } from "@/lib/utils"

export default function AwardsPage() {
  useEffect(() => {
    // Track awards usage
    trackSectionUsage("awards")
  }, [])

  const { colorTheme } = useUserSettings() // Get the current color theme

  // SBHS Award categories from the official scheme
  const categories = [
    "All",
    "Academic",
    "Sports",
    "Co-Curricular Teams",
    "Performing Arts",
    "High Spirit",
    "Service",
    "Leadership",
  ]


  // Sample fallback category data (used when portal API is not available)
  const sampleCategoryData: Record<string, { points: number; nominations: number }> = {
    Academic: { points: 85, nominations: 2 }, // 85 points = 2 nominations
    Sports: { points: 45, nominations: 1 },
    "Co-Curricular Teams": { points: 50, nominations: 1 },
    "Performing Arts": { points: 22, nominations: 0 },
    "High Spirit": { points: 35, nominations: 1 },
    Service: { points: 45, nominations: 1 },
    Leadership: { points: 60, nominations: 2 },
  }

  // Award points data from portal
  const awardPoints = useAwardPoints()

  // If awardPoints.data is available, derive per-category totals and nominations
  const categoryTotalsFromApi: Record<string, { points: number; nominations: number }> = {}
  if (awardPoints.data && Array.isArray(awardPoints.data.awards)) {
    awardPoints.data.awards.forEach((a: any) => {
      const cat = a.category || "Other"
      const pts = Number(a.points) || 0
      if (!categoryTotalsFromApi[cat]) categoryTotalsFromApi[cat] = { points: 0, nominations: 0 }
      categoryTotalsFromApi[cat].points += pts
    })
    Object.keys(categoryTotalsFromApi).forEach((cat) => {
      categoryTotalsFromApi[cat].nominations = Math.floor(categoryTotalsFromApi[cat].points / 30)
    })
  }

  // Build final category data: prefer API-derived totals, otherwise fall back to samples
  const categoryData: Record<string, { points: number; nominations: number }> = {}
  categories.forEach((cat) => {
    if (cat === "All") return
    if (categoryTotalsFromApi[cat]) {
      categoryData[cat] = categoryTotalsFromApi[cat]
    } else if (sampleCategoryData[cat]) {
      categoryData[cat] = sampleCategoryData[cat]
    } else {
      categoryData[cat] = { points: 0, nominations: 0 }
    }
  })

  // Calculate total nominations across all categories (computed from final categoryData)
  const totalNominations = Object.values(categoryData).reduce((sum, cat) => sum + cat.nominations, 0)
  const totalPoints = Object.values(categoryData).reduce((sum, cat) => sum + cat.points, 0)



  // Recent points earned (realistic SBHS activities) - organized by category
  const recentPoints = [
    {
      id: 1,
      title: "Mathematics Competition - High Distinction",
      points: 25,
      date: "April 15, 2025",
      category: "Academic",
      description: "Outstanding performance in Australian Mathematics Competition",
    },
    {
      id: 2,
      title: "English Essay Competition - 1st Place",
      points: 30,
      date: "March 20, 2025",
      category: "Academic",
      description: "First place in annual English essay writing competition",
    },
    {
      id: 3,
      title: "Science Fair - Excellence Award",
      points: 30,
      date: "February 10, 2025",
      category: "Academic",
      description: "Excellence award for innovative science project",
    },
    {
      id: 4,
      title: "House Swimming Carnival Participation",
      points: 15,
      date: "March 10, 2025",
      category: "Sports",
      description: "Active participation in annual house swimming carnival",
    },
    {
      id: 5,
      title: "Cross Country - House Champion",
      points: 30,
      date: "February 5, 2025",
      category: "Sports",
      description: "House champion in annual cross country event",
    },
    {
      id: 6,
      title: "Debating Team - Regional Competition",
      points: 20,
      date: "February 28, 2025",
      category: "Co-Curricular Teams",
      description: "Representing school in regional debating competition",
    },
    {
      id: 7,
      title: "Chess Team - State Finals",
      points: 30,
      date: "January 15, 2025",
      category: "Co-Curricular Teams",
      description: "Competing in state chess championship finals",
    },
    {
      id: 8,
      title: "School Concert Performance",
      points: 12,
      date: "December 10, 2024",
      category: "Performing Arts",
      description: "Solo performance in annual school concert",
    },
    {
      id: 9,
      title: "Drama Production - Lead Role",
      points: 10,
      date: "November 20, 2024",
      category: "Performing Arts",
      description: "Lead role in school drama production",
    },
    {
      id: 10,
      title: "School Spirit - Assembly Participation",
      points: 5,
      date: "February 15, 2025",
      category: "High Spirit",
      description: "Demonstrating school spirit during weekly assembly",
    },
    {
      id: 11,
      title: "House Spirit - Carnival Support",
      points: 30,
      date: "January 25, 2025",
      category: "High Spirit",
      description: "Outstanding house spirit and support during sports carnival",
    },
    {
      id: 12,
      title: "Community Service - Local Charity",
      points: 15,
      date: "January 20, 2025",
      category: "Service",
      description: "Volunteering at local community charity event",
    },
    {
      id: 13,
      title: "Environmental Club - Tree Planting",
      points: 30,
      date: "December 5, 2024",
      category: "Service",
      description: "Leading environmental club tree planting initiative",
    },
    {
      id: 14,
      title: "Peer Support Leader",
      points: 30,
      date: "January 30, 2025",
      category: "Leadership",
      description: "Leading Year 7 peer support group throughout term",
    },
    {
      id: 15,
      title: "SRC Representative",
      points: 30,
      date: "November 10, 2024",
      category: "Leadership",
      description: "Elected Student Representative Council member",
    },
  ]

  // SBHS Award levels based on nominations (from official scheme)
  const awardLevels = [
    { name: "Bronze Award", nominations: 3, icon: Medal, color: "bg-amber-600", achieved: totalNominations >= 3 },
    { name: "Silver Award", nominations: 8, icon: Medal, color: "bg-gray-400", achieved: totalNominations >= 8 },
    { name: "Gold Award", nominations: 13, icon: Medal, color: "bg-yellow-500", achieved: totalNominations >= 13 },
    { name: "Platinum Award", nominations: 18, icon: Trophy, color: "bg-purple-400", achieved: totalNominations >= 18 },
    { name: "School Plaque", nominations: 24, icon: Trophy, color: "bg-blue-600", achieved: totalNominations >= 24 },
    {
      name: "The School Trophy",
      nominations: 30,
      icon: Trophy,
      color: "bg-green-600",
      achieved: totalNominations >= 30,
    },
    {
      name: "Nathan McDonnell Award",
      nominations: 37,
      icon: Star,
      color: "bg-red-600",
      achieved: totalNominations >= 37,
    },
    {
      name: "Joseph Coates Award",
      nominations: 44,
      icon: Star,
      color: "bg-purple-800",
      achieved: totalNominations >= 44,
    },
  ]

  // Find current and next award levels
  const getCurrentLevel = () => {
    let current = null
    let next = null

    for (let i = 0; i < awardLevels.length; i++) {
      if (totalNominations >= awardLevels[i].nominations) {
        current = awardLevels[i]
      } else if (!next) {
        next = awardLevels[i]
        break
      }
    }

    return { current, next }
  }

  const { current: currentLevel, next: nextLevel } = getCurrentLevel()

  const participation = useParticipation()

  // If participation data is available, adapt it for display
  const participationList: any[] = participation.data && Array.isArray(participation.data)
    ? participation.data.map((p: any, i: number) => ({
        id: i,
        year: p.year,
        activity: p.activity,
        category: p.categoryName || p.category,
        points: Number.isFinite(Number(p.points)) ? Number(p.points) : p.points,
        pointsCap: p.pointsCap || undefined,
      }))
    : []

  return (
    <PageTransition>
      <div className="container max-w-6xl mx-auto px-4 py-6 pb-24">
        <div className="flex items-center justify-between mb-4 md:mb-6 px-4 py-2 bg-surface-container-low border-b border-outline-variant w-full rounded-xl">
          {/* Back button hidden on mobile (show on md+) */}
          <Link href="/" className="hidden md:flex text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-6 w-6" />
          </Link>

          {/* Heading: left-aligned on mobile, centered on md+; smaller on mobile */}
          <h1 className="text-lg font-bold text-left md:text-center md:flex-1 font-serif">Student Awards</h1>

          <div className="w-6"></div>
        </div>

        {/* Overall Progress Card */}
        <Card className="card-optimized-main mb-6 bg-surface-container shadow-elevation-1">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full p-2 bg-secondary-container text-secondary-container-foreground">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold">Total Nominations</h2>
                  <p className="text-sm text-muted-foreground">
                    {currentLevel ? `${currentLevel.name} achieved` : "Working towards first award"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-primary">{totalNominations}</div>
                <div className="text-sm text-muted-foreground">nominations</div>
              </div>
            </div>

            {nextLevel && (
              <>
                <div className="mb-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Progress to {nextLevel.name}</span>
                    <span className="font-semibold text-primary">
                      {Math.round((totalNominations / nextLevel.nominations) * 100)}%
                    </span>
                  </div>
                  <Progress
                    value={(totalNominations / nextLevel.nominations) * 100}
                    className="h-2 bg-surface-variant"
                  />
                </div>

                <div className="text-sm text-muted-foreground text-center mt-2">
                  <span className="font-semibold text-primary">{nextLevel.nominations - totalNominations}</span>{" "}
                  more nominations needed for {nextLevel.name}
                </div>
              </>
            )}

            {!nextLevel && (
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-primary mb-2">
                  <Trophy className="h-5 w-5" />
                  <span className="font-semibold">Highest Award Achieved!</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Congratulations on reaching the Joseph Coates Award
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Progress Cards - Enhanced Grid */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 font-serif">Progress by Category</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Object.entries(categoryData).map(([category, data]) => {
              const pointsToNextNomination = 30 - (data.points % 30)
              const progressToNext = ((data.points % 30) / 30) * 100

              return (
                <Card
                  key={category}
                  className="rounded-m3-xl bg-surface-container-low shadow-sm p-4 border-none hover:shadow-md transition-all hover:scale-[1.02]"
                >
                  <div className="text-center mb-2">
                    <h4 className="font-semibold text-sm mb-1">{category}</h4>
                    <div className="text-2xl font-bold text-primary">{data.nominations}</div>
                    <p className="text-xs text-muted-foreground">{data.points} pts</p>
                  </div>

                  {data.points % 30 !== 0 && (
                    <div>
                      <Progress
                        value={progressToNext}
                        className="h-1.5 mb-1 bg-surface-variant"
                      />
                      <div className="text-xs text-muted-foreground text-center">
                        +{pointsToNextNomination} for next
                      </div>
                    </div>
                  )}
                  {data.points % 30 === 0 && data.points > 0 && (
                    <div className="text-xs text-green-600 dark:text-green-400 text-center font-medium">
                      Nomination achieved!
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </div>

        {/* Award Levels - Dynamic View */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 font-serif">Award Progress</h3>
          <div className="space-y-1.5">
            {awardLevels.map((level, index) => {
              const isAchieved = level.achieved
              const isCurrent = nextLevel?.name === level.name && !isAchieved
              const IconComponent = level.icon

              return (
                <Card
                  key={level.name}
                  className={cn(
                    "rounded-xl shadow-sm p-3 border transition-all duration-200 hover:scale-[1.01]",
                    isAchieved
                      ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20"
                      : isCurrent
                        ? "border-primary bg-primary-container"
                        : "border-transparent bg-surface-container-low"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "rounded-full p-1.5",
                          isAchieved
                            ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                            : isCurrent
                              ? "bg-primary text-primary-foreground"
                              : "bg-surface-variant text-muted-foreground"
                        )}
                      >
                        <IconComponent className="h-3 w-3" />
                      </div>
                      <div>
                        <p
                          className={cn(
                            "font-semibold text-sm",
                            isAchieved ? "text-green-900 dark:text-green-100" : isCurrent ? "text-primary-container-foreground" : ""
                          )}
                        >
                          {level.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{level.nominations} nominations</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAchieved && (
                        <span className="text-xs bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                          Achieved
                        </span>
                      )}
                      {isCurrent && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                          Next
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-4 font-serif">Recent Points Earned</h2>

        {/* Participation list from portal (if authenticated) */}
        {participation.loading && <p className="text-sm text-muted-foreground">Loading participation...</p>}
        {participation.error && <p className="text-sm text-destructive">{participation.error}</p>}

        {!participation.loading && !participation.error && (
          participationList.length > 0 ? (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2">Participation Entries</h3>
              <div className="space-y-3">
                {participationList.map((p) => (
                  <Card key={p.id} className="rounded-xl p-3 border-none bg-surface-container-low shadow-sm">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-semibold">{p.activity}</div>
                        <div className="text-xs text-muted-foreground">{p.category} • Year {p.year}</div>
                      </div>
                      <div className="text-sm font-medium">
                        {p.points}{p.pointsCap ? ` / ${p.pointsCap}` : " pts"}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Tabs defaultValue="All" className="mb-6">
              <div className="overflow-x-auto pb-2 no-scrollbar">
                <TabsList className="inline-flex min-w-full mb-4 bg-surface-variant/50 p-1 rounded-full h-auto">
                  {categories.map((category) => (
                    <TabsTrigger
                      key={category}
                      value={category}
                      className="text-xs whitespace-nowrap rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2 transition-all duration-200"
                    >
                      {category === "Co-Curricular Teams" ? "Teams" : category === "Performing Arts" ? "Arts" : category}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {categories.map((category) => (
                <TabsContent key={category} value={category}>
                  <div className="space-y-2">
                    {recentPoints
                      .filter((point) => category === "All" || point.category === category)
                      .slice(0, 6)
                      .map((point) => (
                        <Card
                          key={point.id}
                          className="rounded-xl bg-surface-container-low shadow-sm p-3 border-none hover:shadow-md transition-all"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex-1 pr-2">
                              <h3 className="font-semibold text-sm leading-tight">{point.title}</h3>
                              <p className="text-xs text-muted-foreground">{point.date}</p>
                            </div>
                            <div className="flex items-center gap-1 bg-secondary-container text-secondary-container-foreground px-2 py-1 rounded-full flex-shrink-0">
                              <TrendingUp className="h-3 w-3" />
                              <span className="text-xs font-medium">+{point.points}</span>
                            </div>
                          </div>
                          <p className="text-xs mb-2 text-muted-foreground line-clamp-2">{point.description}</p>
                          <div className="flex justify-between items-center">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-surface-variant text-on-surface-variant">
                              {point.category}
                            </span>
                            <span className="text-xs text-muted-foreground">→ {point.category}</span>
                          </div>
                        </Card>
                      ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )
        )}

        {/* Awards summary (API-driven when available) */}
        {awardPoints.loading ? (
          <p className="text-sm text-muted-foreground">Loading awards data...</p>
        ) : awardPoints.error ? (
          <p className="text-sm text-destructive">{awardPoints.error}</p>
        ) : awardPoints.data && Array.isArray(awardPoints.data.awards) && awardPoints.data.awards.length > 0 ? (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Award Breakdown</h3>

            {/* Per-category summary grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
              {Object.entries(categoryData).map(([cat, stats]) => (
                <Card key={cat} className="rounded-xl p-3 border-none bg-surface-container-low shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{cat}</p>
                      <p className="text-xs text-muted-foreground">{stats.points} pts</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary">{stats.nominations}</div>
                      <div className="text-xs text-muted-foreground">nominations</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <h3 className="text-lg font-medium mb-2">Individual Awards</h3>
            <div className="space-y-3">
              {awardPoints.data.awards.map((a: any, idx: number) => (
                <Card key={a.id ?? idx} className="rounded-xl p-3 border-none bg-surface-container-low shadow-sm">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <div className="font-semibold">{a.title || a.activity || a.category}</div>
                      {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
                      <div className="text-xs text-muted-foreground mt-1">{a.awardedDate ? a.awardedDate : a.date}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{a.points} pts</div>
                      {a.awardedBy && <div className="text-xs text-muted-foreground">by {a.awardedBy}</div>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : null}

        {/* Information Cards */}
        <div className="space-y-4">
          <Card className="rounded-m3-xl bg-primary-container/50 border-none p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full p-1 bg-primary/10 text-primary">
                <Award className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-primary-container-foreground mb-1">How It Works</h3>
                <p className="text-sm text-primary-container-foreground/80">
                  Earn points in each category separately. Every 30 points in a category = 1 nomination for that
                  category. Awards are based on your total nominations across all categories.
                </p>
              </div>
            </div>
          </Card>

          <Card className="rounded-m3-xl bg-tertiary-container/50 border-none p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full p-1 bg-tertiary/10 text-tertiary">
                <Download className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-tertiary-container-foreground mb-1">Points Schedule</h3>
                <p className="text-sm text-tertiary-container-foreground/80 mb-2">
                  View the complete points schedule for all activities in each category.
                </p>
                <a
                  href="https://sydneyhigh.school/wellbeing/award-scheme"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-tertiary hover:underline flex items-center gap-1"
                >
                  <Download className="h-3 w-3" />
                  Download Points Schedule
                </a>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PageTransition>
  )
}
