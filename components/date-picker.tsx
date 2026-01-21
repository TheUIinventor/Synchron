'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedDate: Date
  onDateSelect: (date: Date) => void
  title?: string
}

export function DatePicker({
  open,
  onOpenChange,
  selectedDate,
  onDateSelect,
  title = "Select Date"
}: DatePickerProps) {
  const [displayMonth, setDisplayMonth] = React.useState<Date>(() => {
    return new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  })

  const [tempSelected, setTempSelected] = React.useState(selectedDate)

  // Update temp selection when selectedDate prop changes
  React.useEffect(() => {
    setTempSelected(selectedDate)
  }, [selectedDate])

  // Update display month when opening
  React.useEffect(() => {
    if (open) {
      setDisplayMonth(new Date(tempSelected.getFullYear(), tempSelected.getMonth(), 1))
    }
  }, [open, tempSelected])

  const goToPreviousMonth = () => {
    setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))
  }

  const handleDateClick = (day: number) => {
    const newDate = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day)
    setTempSelected(newDate)
  }

  const handleConfirm = () => {
    onDateSelect(tempSelected)
    onOpenChange(false)
  }

  const handleCancel = () => {
    setTempSelected(selectedDate)
    onOpenChange(false)
  }

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    )
  }

  const daysInMonth = getDaysInMonth(displayMonth)
  const firstDay = getFirstDayOfMonth(displayMonth)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i)

  const weekDays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
  const adjustedWeekDays = [...weekDays.slice(1), weekDays[0]] // Rotate to start with Monday

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-sm p-6">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Month/Year Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPreviousMonth}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <h2 className="text-lg font-semibold">
              {formatMonthYear(displayMonth)}
            </h2>

            <Button
              variant="ghost"
              size="sm"
              onClick={goToNextMonth}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2 mb-6">
            {/* Weekday headers */}
            {adjustedWeekDays.map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}

            {/* Empty days before month starts */}
            {emptyDays.map((i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {/* Days of month */}
            {days.map((day) => {
              const isSelected = isSameDay(tempSelected, new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day))
              const isToday = isSameDay(new Date(), new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day))

              return (
                <button
                  key={day}
                  onClick={() => handleDateClick(day)}
                  className={cn(
                    'aspect-square rounded-md text-sm font-medium transition-colors',
                    'hover:bg-muted',
                    isSelected && 'bg-primary text-primary-foreground hover:bg-primary',
                    isToday && !isSelected && 'border-2 border-primary'
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Selected Date Display */}
          <div className="bg-muted p-4 rounded-lg text-center">
            <p className="text-sm text-muted-foreground mb-1">Selected:</p>
            <p className="text-lg font-semibold">
              {tempSelected.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-center pt-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              className="flex-1"
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
