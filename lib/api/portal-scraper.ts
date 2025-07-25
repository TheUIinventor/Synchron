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
