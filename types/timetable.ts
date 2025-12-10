// Shared type definitions for timetable entities to avoid circular imports
export type Period = {
  id?: number
  period: string
  time: string
  subject: string
  teacher: string
  room: string
  weekType?: "A" | "B"
  isSubstitute?: boolean
  isRoomChange?: boolean
  fullTeacher?: string
  casualSurname?: string
  displayTeacher?: string
}

export type BellTime = {
  period: string
  time: string
}
