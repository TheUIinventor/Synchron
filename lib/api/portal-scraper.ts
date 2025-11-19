"use client"

// Utility functions for scraping SBHS Student Portal data
export class PortalScraper {
  static extractTimetableData(html: string): any {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    // Look for timetable table - common patterns in school portals
    const timetableSelectors = [
      "table.timetable",
      'table[id*="timetable"]',
      'table[class*="schedule"]',
      ".timetable-container table",
      "#timetable table",
    ]

    let timetableTable: Element | null = null
    for (const selector of timetableSelectors) {
      timetableTable = doc.querySelector(selector)
      if (timetableTable) break
    }

    if (!timetableTable) {
      // Fallback: look for any table with period/time data
      const tables = doc.querySelectorAll("table")
      for (const table of tables) {
        const headerText = table.textContent?.toLowerCase() || ""
        if (headerText.includes("period") && headerText.includes("time")) {
          timetableTable = table
          break
        }
      }
    }

    if (timetableTable) {
      return this.parseTable(timetableTable)
    }

    return []
  }

  static extractNoticesData(html: string): any {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    const notices: any[] = []

    // Common notice selectors
    const noticeSelectors = [".notice", ".daily-notice", ".announcement", '[class*="notice"]', ".news-item"]

    for (const selector of noticeSelectors) {
      const elements = doc.querySelectorAll(selector)
      elements.forEach((element) => {
        const notice = this.parseNoticeElement(element)
        if (notice) notices.push(notice)
      })
    }

    // Fallback: look for list items that might be notices
    if (notices.length === 0) {
      const listItems = doc.querySelectorAll("li, .item")
      listItems.forEach((item) => {
        const text = item.textContent?.trim()
        if (text && text.length > 20) {
          // Likely a notice if it's substantial text
          notices.push({
            title: text.substring(0, 50) + (text.length > 50 ? "..." : ""),
            content: text,
            date: new Date().toISOString().split("T")[0],
            category: "General",
          })
        }
      })
    }

    return notices
  }

  static extractStudentData(html: string): any {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    const student: any = {}

    // Look for student name
    const nameSelectors = [".student-name", ".profile-name", '[class*="name"]', "h1, h2, h3"]

    for (const selector of nameSelectors) {
      const element = doc.querySelector(selector)
      if (element) {
        const text = element.textContent?.trim()
        if (text && text.includes(" ")) {
          // Likely a full name
          student.name = text
          break
        }
      }
    }

    // Look for year/grade
    const yearPattern = /year\s*(\d+)|grade\s*(\d+)|yr\s*(\d+)/i
    const bodyText = doc.body.textContent || ""
    const yearMatch = bodyText.match(yearPattern)
    if (yearMatch) {
      student.year = Number.parseInt(yearMatch[1] || yearMatch[2] || yearMatch[3])
    }

    // Look for house
    const housePattern = /house:\s*(\w+)|(\w+)\s*house/i
    const houseMatch = bodyText.match(housePattern)
    if (houseMatch) {
      student.house = houseMatch[1] || houseMatch[2]
    }

    return student
  }

  // Attempt to extract variations/substitutions from a parsed JSON object
  static extractVariationsFromJson(data: any): any[] {
    if (!data) return []

    // Common locations: data.variations, data.classVariations, data.days[].variations
    const collected: any[] = []

    const pushVariation = (v: any) => {
      if (!v) return
      const normalize = (obj: any) => {
        return {
          id: obj.id || obj.variationId || obj.vid || undefined,
          date: obj.date || obj.day || obj.when || undefined,
          period: obj.period || obj.periodName || obj.t || undefined,
          subject: obj.subject || obj.class || obj.title || undefined,
          originalTeacher: obj.teacher || obj.originalTeacher || obj.teacherName || undefined,
          substituteTeacher: obj.substitute || obj.replacement || obj.replacementTeacher || obj.substituteTeacher || undefined,
          fromRoom: obj.fromRoom || obj.from || obj.oldRoom || undefined,
          toRoom: obj.toRoom || obj.to || obj.room || obj.newRoom || undefined,
          reason: obj.reason || obj.note || obj.comment || undefined,
          raw: obj,
        }
      }

      if (Array.isArray(v)) {
        v.forEach((x) => collected.push(normalize(x)))
      } else if (typeof v === "object") {
        collected.push(normalize(v))
      }
    }

    if (Array.isArray(data.variations)) pushVariation(data.variations)
    if (Array.isArray(data.classVariations)) pushVariation(data.classVariations)

    // Some APIs nest timetable by days
    if (Array.isArray(data.days)) {
      data.days.forEach((d: any) => {
        if (Array.isArray(d.variations)) pushVariation(d.variations)
        if (Array.isArray(d.classVariations)) pushVariation(d.classVariations)
      })
    }

    // Some endpoints attach variations under timetable or similar
    if (data.timetable && Array.isArray(data.timetable.variations)) pushVariation(data.timetable.variations)

    // As a last resort, search recursively for arrays that look like variations
    const searchForArrays = (obj: any) => {
      if (!obj || typeof obj !== "object") return
      for (const k of Object.keys(obj)) {
        const val = obj[k]
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
          // Heuristic: array items that have keys like 'teacher' or 'substitute' or 'room'
          const sample = val[0]
          const keys = Object.keys(sample).join("|").toLowerCase()
          if (keys.includes("substitute") || keys.includes("variation") || keys.includes("room") || keys.includes("teacher")) {
            pushVariation(val)
          }
        } else if (typeof val === "object") {
          searchForArrays(val)
        }
      }
    }

    searchForArrays(data)

    return collected
  }

  // Extract variations/substitutions from an HTML timetable/notice page
  static extractVariationsFromHtml(html: string): any[] {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    const keywords = ["variation", "substitute", "substitutions", "relief", "replacement", "room change", "room"]
    const tables = Array.from(doc.querySelectorAll("table"))
    const results: any[] = []

    for (const table of tables) {
      const headerText = table.textContent?.toLowerCase() || ""
      if (keywords.some((k) => headerText.includes(k))) {
        // parse rows
        const rows = Array.from(table.querySelectorAll("tr")).slice(1)
        rows.forEach((row) => {
          const cells = Array.from(row.querySelectorAll("td, th"))
          const textCells = cells.map((c) => c.textContent?.trim() || "")
          // Map heuristically: period, subject, teacher, substitute, fromRoom, toRoom, reason
          results.push({
            period: textCells[0] || undefined,
            subject: textCells[1] || undefined,
            originalTeacher: textCells[2] || undefined,
            substituteTeacher: textCells[3] || undefined,
            fromRoom: textCells[4] || undefined,
            toRoom: textCells[5] || textCells[4] || undefined,
            reason: textCells[6] || undefined,
            raw: textCells,
          })
        })
      }
    }

    // Also try notices/lists
    const noticeAreas = Array.from(doc.querySelectorAll(".notice, .daily-notice, .announcement, li"))
    noticeAreas.forEach((el) => {
      const text = el.textContent?.trim() || ""
      if (keywords.some((k) => text.toLowerCase().includes(k))) {
        results.push({
          subject: undefined,
          originalTeacher: undefined,
          substituteTeacher: undefined,
          fromRoom: undefined,
          toRoom: undefined,
          reason: text,
          raw: text,
        })
      }
    })

    return results
  }

  private static parseTable(table: Element): any[] {
    const rows = Array.from(table.querySelectorAll("tr"))
    const data: any[] = []

    // Skip header row(s)
    const dataRows = rows.slice(1)

    dataRows.forEach((row, index) => {
      const cells = Array.from(row.querySelectorAll("td, th"))
      if (cells.length >= 3) {
        const rowData: any = {}

        // Common timetable column patterns
        cells.forEach((cell, cellIndex) => {
          const text = cell.textContent?.trim() || ""

          switch (cellIndex) {
            case 0:
              rowData.period = text
              break
            case 1:
              rowData.time = text
              break
            case 2:
              rowData.subject = text
              break
            case 3:
              rowData.teacher = text
              break
            case 4:
              rowData.room = text
              break
          }
        })

        if (rowData.period || rowData.time || rowData.subject) {
          data.push(rowData)
        }
      }
    })

    return data
  }

  private static parseNoticeElement(element: Element): any | null {
    const title = element.querySelector("h1, h2, h3, h4, .title, .heading")?.textContent?.trim()
    const content = element.querySelector("p, .content, .description")?.textContent?.trim()
    const date = element.querySelector(".date, .published, time")?.textContent?.trim()

    if (title || content) {
      return {
        title: title || content?.substring(0, 50) + "...",
        content: content || title,
        date: date || new Date().toISOString().split("T")[0],
        category: "General",
      }
    }

    return null
  }
}
