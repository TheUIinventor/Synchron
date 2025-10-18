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
  private accessToken: string | null = null
  private sessionId: string | null = null
  private csrfToken: string | null = null

  constructor() {
    this.baseUrl = API_BASE_URL
    this.portalUrl = PORTAL_BASE_URL
    this.loadAccessTokenFromCookie()
  }

  private loadAccessTokenFromCookie() {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(/(?:^|; )sbhs_access_token=([^;]*)/)
      this.accessToken = match ? decodeURIComponent(match[1]) : null
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
      const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> || {}),
      }

      // Add access token from cookie if available
      this.loadAccessTokenFromCookie()
      if (this.accessToken) {
        headers["Authorization"] = `Bearer ${this.accessToken}`
      }

      // Only set Content-Type if a body is present and no Content-Type provided
      if (options.body && !headers["Content-Type"]) {
        // If body is a plain object, assume JSON; otherwise leave to caller
        if (typeof options.body === "string") {
          headers["Content-Type"] = "application/x-www-form-urlencoded"
        } else {
          headers["Content-Type"] = "application/json"
        }
      }

      // Debug: log request metadata (do not print sensitive tokens)
      try {
        console.debug("SBHS Portal Request:", {
          method: (options.method || "GET").toUpperCase(),
          url,
          hasAuthorization: !!headers["Authorization"],
        })
      } catch (e) {
        /* ignore logging errors */
      }

      const response = await fetch(url, {
        ...options,
        headers,
        credentials: "include",
      })

      // Handle session expiration
      if (response.status === 401) {
        this.clearSession()
        return {
          success: false,
          error: "Session expired. Please log in again.",
        }
      }

      // Try to parse response as JSON, fallback to text
      let data: any
      const contentType = response.headers.get("content-type")
      // Debug: log response status and contentType
      try {
        console.debug("SBHS Portal Response:", { status: response.status, contentType })
      } catch (e) {
        /* ignore */
      }

      if (contentType && contentType.includes("application/json")) {
        data = await response.json()
      } else {
        const text = await response.text()
        // Debug: show a short preview of returned HTML/text to diagnose failures
        try {
          console.debug("SBHS Portal Response Preview:", text.slice(0, 1000))
        } catch (e) {
          /* ignore */
        }
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
    this.accessToken = null
    this.sessionId = null
    this.csrfToken = null
    if (typeof document !== "undefined") {
      document.cookie = "sbhs_access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "sbhs_refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("sbhs_session_id")
      localStorage.removeItem("sbhs_csrf_token")
      localStorage.removeItem("sbhs_session_expires")
    }
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
    // If running in the browser, prefer our server-side proxy to avoid CORS and cookie issues
    try {
      if (typeof window !== "undefined") {
        const res = await fetch(`/api/portal/userinfo`, { credentials: 'include' })
        if (!res.ok) {
          // fall back to direct portal request if proxy fails
          return this.makePortalRequest<StudentProfile>("/details/userinfo.json")
        }
        const payload = await res.json()
        // If proxy returns success wrapper, normalize it
        if (payload && payload.success && payload.data) {
          return { success: true, data: payload.data }
        }
        if (payload && payload.data) {
          return { success: true, data: payload.data }
        }
        // If payload itself looks like profile, return it
        return { success: true, data: payload }
      }
    } catch (err) {
      // ignore and fall back to portal request
    }

    // Server or fallback
    return this.makePortalRequest<StudentProfile>("/details/userinfo.json")
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
    if (typeof window !== "undefined") {
      return this.makePortalRequest<AwardPointsResponse>("/api/portal/awards")
    }
    return this.makePortalRequest<AwardPointsResponse>("/awards")
  }

  // Participation - returns list of participation entries for awards scheme
  async getParticipation(): Promise<ApiResponse<ParticipationEntry[]>> {
    if (typeof window !== "undefined") {
      return this.makePortalRequest<ParticipationEntry[]>('/api/portal/participation')
    }
    return this.makePortalRequest<ParticipationEntry[]>('/details/participation.json')
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
    this.loadAccessTokenFromCookie();
    return !!this.accessToken;
  }
}

// Export singleton instance
export const sbhsPortal = new SBHSPortalClient()

// Type definitions remain the same
export interface StudentProfile {
  username: string;
  studentId: string;
  givenName: string;
  surname: string;
  rollclass: string;
  yearGroup: string;
  role: string;
  department: string;
  office: string;
  email: string;
  emailAliases: string[];
  decEmail: string;
  groups: string[];
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

export interface ParticipationEntry {
  year: string
  activity: string
  category: string
  categoryName?: string
  points: number | string
  pointsCap?: number
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
