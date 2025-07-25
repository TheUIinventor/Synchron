"use client"

// SBHS Student Portal Configuration
const PORTAL_BASE_URL = "https://student.sbhs.net.au"
const API_BASE_URL = process.env.NEXT_PUBLIC_SBHS_API_URL || `${PORTAL_BASE_URL}/api`

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface AuthTokens {
  sessionId: string
  csrfToken: string
  expiresAt: number
}

class SBHSPortalClient {
  private baseUrl: string
  private portalUrl: string
  private sessionId: string | null = null
  private csrfToken: string | null = null

  constructor() {
    this.baseUrl = API_BASE_URL
    this.portalUrl = PORTAL_BASE_URL
    this.loadSessionFromStorage()
  }

  private loadSessionFromStorage() {
    if (typeof window !== "undefined") {
      const sessionId = localStorage.getItem("sbhs_session_id")
      const csrfToken = localStorage.getItem("sbhs_csrf_token")
      if (sessionId && csrfToken) {
        this.sessionId = sessionId
        this.csrfToken = csrfToken
      }
    }
  }

  private saveSessionToStorage(tokens: AuthTokens) {
    if (typeof window !== "undefined") {
      localStorage.setItem("sbhs_session_id", tokens.sessionId)
      localStorage.setItem("sbhs_csrf_token", tokens.csrfToken)
      localStorage.setItem("sbhs_session_expires", tokens.expiresAt.toString())
    }
  }

  private async makePortalRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const url = endpoint.startsWith("http") ? endpoint : `${this.portalUrl}${endpoint}`
      const headers: HeadersInit = {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Schedul-App/1.0",
        ...options.headers,
      }

      // Add session cookies if available
      if (this.sessionId) {
        headers.Cookie = `PHPSESSID=${this.sessionId}`
      }

      // Add CSRF token if available
      if (this.csrfToken && options.method === "POST") {
        if (options.body && typeof options.body === "string") {
          options.body += `&csrf_token=${this.csrfToken}`
        }
      }

      const response = await fetch(url, {
        ...options,
        headers,
        credentials: "include",
      })

      // Handle session expiration
      if (response.status === 401 || response.url.includes("/login")) {
        this.clearSession()
        return {
          success: false,
          error: "Session expired. Please log in again.",
        }
      }

      // Try to parse response as JSON, fallback to text
      let data: any
      const contentType = response.headers.get("content-type")
      if (contentType && contentType.includes("application/json")) {
        data = await response.json()
      } else {
        const text = await response.text()
        // Parse HTML response for data extraction
        data = this.parseHtmlResponse(text)
      }

      return {
        success: response.ok,
        data: response.ok ? data : undefined,
        error: !response.ok ? data.message || "Request failed" : undefined,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error",
      }
    }
  }

  private parseHtmlResponse(html: string): any {
    // Basic HTML parsing for extracting data from portal pages
    // This would need to be customized based on actual SBHS portal structure
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    // Look for common data patterns in SBHS portal
    const data: any = {}

    // Extract timetable data
    const timetableTable = doc.querySelector('table[class*="timetable"], .timetable table')
    if (timetableTable) {
      data.timetable = this.extractTimetableFromTable(timetableTable)
    }

    // Extract notices
    const noticesContainer = doc.querySelector('.notices, [class*="notice"], .daily-notices')
    if (noticesContainer) {
      data.notices = this.extractNoticesFromContainer(noticesContainer)
    }

    // Extract student info
    const studentInfo = doc.querySelector('.student-info, [class*="profile"]')
    if (studentInfo) {
      data.student = this.extractStudentInfo(studentInfo)
    }

    return data
  }

  private extractTimetableFromTable(table: Element): any[] {
    const rows = Array.from(table.querySelectorAll("tr"))
    const timetable: any[] = []

    rows.forEach((row, index) => {
      if (index === 0) return // Skip header row

      const cells = Array.from(row.querySelectorAll("td, th"))
      if (cells.length >= 4) {
        timetable.push({
          period: cells[0]?.textContent?.trim() || "",
          time: cells[1]?.textContent?.trim() || "",
          subject: cells[2]?.textContent?.trim() || "",
          teacher: cells[3]?.textContent?.trim() || "",
          room: cells[4]?.textContent?.trim() || "",
        })
      }
    })

    return timetable
  }

  private extractNoticesFromContainer(container: Element): any[] {
    const notices: any[] = []
    const noticeElements = container.querySelectorAll(".notice, .notice-item, li")

    noticeElements.forEach((element) => {
      const title = element.querySelector("h3, .title, strong")?.textContent?.trim()
      const content = element.querySelector("p, .content")?.textContent?.trim()
      const date = element.querySelector(".date, .published")?.textContent?.trim()

      if (title) {
        notices.push({
          title,
          content: content || "",
          date: date || "",
          category: "General",
        })
      }
    })

    return notices
  }

  private extractStudentInfo(container: Element): any {
    const info: any = {}

    // Extract common student information patterns
    const nameElement = container.querySelector(".name, .student-name")
    if (nameElement) {
      info.name = nameElement.textContent?.trim()
    }

    const yearElement = container.querySelector(".year, .grade")
    if (yearElement) {
      info.year = yearElement.textContent?.trim()
    }

    const houseElement = container.querySelector(".house")
    if (houseElement) {
      info.house = houseElement.textContent?.trim()
    }

    return info
  }

  async initiateLogin(): Promise<string> {
    // Generate a state parameter for security
    const state = Math.random().toString(36).substring(2, 15)
    localStorage.setItem("sbhs_auth_state", state)

    // Redirect URL back to our app
    const redirectUri = `${window.location.origin}/auth/callback`

    // Construct the portal login URL with redirect
    const loginUrl = `${this.portalUrl}/login?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`

    return loginUrl
  }

  async handleAuthCallback(code: string, state: string): Promise<ApiResponse<AuthTokens>> {
    try {
      // Verify state parameter
      const storedState = localStorage.getItem("sbhs_auth_state")
      if (state !== storedState) {
        return {
          success: false,
          error: "Invalid authentication state",
        }
      }

      // Exchange code for session
      const response = await fetch(`${this.baseUrl}/auth/callback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code, state }),
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        const tokens: AuthTokens = {
          sessionId: data.sessionId,
          csrfToken: data.csrfToken,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        }

        this.sessionId = tokens.sessionId
        this.csrfToken = tokens.csrfToken
        this.saveSessionToStorage(tokens)

        return {
          success: true,
          data: tokens,
        }
      }

      return {
        success: false,
        error: "Authentication failed",
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Authentication error",
      }
    }
  }

  private clearSession() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("sbhs_session_id")
      localStorage.removeItem("sbhs_csrf_token")
      localStorage.removeItem("sbhs_session_expires")
    }
    this.sessionId = null
    this.csrfToken = null
  }

  async logout(): Promise<void> {
    try {
      await this.makePortalRequest("/logout", { method: "POST" })
    } catch (error) {
      // Ignore logout errors
    }
    this.clearSession()
  }

  // Student Profile - scrape from main portal page
  async getStudentProfile(): Promise<ApiResponse<StudentProfile>> {
    return this.makePortalRequest<StudentProfile>("/")
  }

  // Timetable - scrape from timetable page
  async getTimetable(week?: "A" | "B"): Promise<ApiResponse<TimetableResponse>> {
    const weekParam = week ? `?week=${week}` : ""
    return this.makePortalRequest<TimetableResponse>(`/timetable${weekParam}`)
  }

  // Daily Notices - scrape from notices page
  async getDailyNotices(date?: string): Promise<ApiResponse<NoticesResponse>> {
    const dateParam = date ? `?date=${date}` : ""
    return this.makePortalRequest<NoticesResponse>(`/notices${dateParam}`)
  }

  // Bell Times - scrape from bell times page
  async getBellTimes(): Promise<ApiResponse<BellTimesResponse>> {
    return this.makePortalRequest<BellTimesResponse>("/bell-times")
  }

  // Award Points - scrape from awards/points page
  async getAwardPoints(): Promise<ApiResponse<AwardPointsResponse>> {
    return this.makePortalRequest<AwardPointsResponse>("/awards")
  }

  // Calendar Events - scrape from calendar page
  async getCalendarEvents(startDate?: string, endDate?: string): Promise<ApiResponse<CalendarResponse>> {
    const params = new URLSearchParams()
    if (startDate) params.append("start", startDate)
    if (endDate) params.append("end", endDate)
    const queryString = params.toString() ? `?${params.toString()}` : ""
    return this.makePortalRequest<CalendarResponse>(`/calendar${queryString}`)
  }

  isAuthenticated(): boolean {
    return !!this.sessionId && !!this.csrfToken
  }
}

// Export singleton instance
export const sbhsPortal = new SBHSPortalClient()

// Type definitions remain the same
export interface StudentProfile {
  id: string
  studentId: string
  firstName: string
  lastName: string
  preferredName?: string
  year: number
  house: string
  email: string
  photoUrl?: string
}

export interface TimetableEntry {
  id: string
  period: string
  startTime: string
  endTime: string
  subject: string
  teacher: string
  room: string
  week?: "A" | "B"
  dayOfWeek: number
}

export interface TimetableResponse {
  currentWeek: "A" | "B"
  entries: TimetableEntry[]
  lastUpdated: string
}

export interface Notice {
  id: string
  title: string
  content: string
  category: string
  targetYears: number[]
  publishedDate: string
  expiryDate?: string
  isPinned: boolean
  authorName: string
}

export interface NoticesResponse {
  notices: Notice[]
  totalCount: number
  lastUpdated: string
}

export interface BellTime {
  period: string
  startTime: string
  endTime?: string
  dayType: "normal" | "assembly" | "sport"
  dayPattern: "mon-tue" | "wed-thu" | "fri"
}

export interface BellTimesResponse {
  bellTimes: BellTime[]
  currentDayType: "normal" | "assembly" | "sport"
  lastUpdated: string
}

export interface AwardPoint {
  id: string
  title: string
  description: string
  points: number
  category: "academic" | "sport" | "service" | "arts" | "other"
  awardedDate: string
  awardedBy: string
}

export interface AwardPointsResponse {
  totalPoints: number
  currentLevel: "bronze" | "silver" | "gold" | "none"
  pointsToNextLevel: number
  awards: AwardPoint[]
  lastUpdated: string
}

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  startDate: string
  endDate: string
  location?: string
  category: string
  isAllDay: boolean
  targetYears?: number[]
}

export interface CalendarResponse {
  events: CalendarEvent[]
  lastUpdated: string
}
