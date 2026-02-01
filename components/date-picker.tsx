'use client'

import * as React from 'react'
import { startTransition } from 'react'
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
    try {
      return new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
    } catch (e) {
      console.error('[DatePicker] invalid selectedDate, falling back to today', e)
      return new Date()
    }
  })

  const [renderError, setRenderError] = React.useState<boolean>(false)

  // Update display month when selectedDate prop changes
  React.useEffect(() => {
    if (open) {
      try {
        if (selectedDate && typeof (selectedDate as any).getFullYear === 'function') {
          setDisplayMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
        } else {
          // Fallback to today when selectedDate is invalid
          setDisplayMonth(new Date())
        }
      } catch (e) {
        setDisplayMonth(new Date())
      }
    }
  }, [selectedDate, open])

  const goToPreviousMonth = () => {
    setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))
  }

  const handleDateClick = (day: number) => {
    // Clone the selected date and update it, matching how previous/next buttons work
    // This preserves the time of day and avoids timezone issues with new Date(year, month, day)
    const newDate = new Date(selectedDate)
    newDate.setFullYear(displayMonth.getFullYear())
    newDate.setMonth(displayMonth.getMonth())
    newDate.setDate(day)
    startTransition(() => {
      onDateSelect(newDate)
    })
    // Close the dialog after selection
    onOpenChange(false)
  }

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    // JS `getDay()` returns 0=Sunday..6=Saturday. We want a Monday-first grid,
    // so shift the index: Monday -> 0, Tuesday -> 1, ..., Sunday -> 6
    const raw = new Date(date.getFullYear(), date.getMonth(), 1).getDay()
    return (raw + 6) % 7
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

  if (renderError) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full max-w-sm p-6">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="p-4 text-center">
            <div className="text-sm text-on-surface-variant">An error occurred while showing the date picker.</div>
            <div className="text-xs text-muted-foreground mt-2">Try again or pick a date using the header controls.</div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Wrap render-critical sections in a try/catch so client-side failures
  // inside the calendar don't crash the whole page.
  try {
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
              const isSelected = isSameDay(selectedDate, new Date(displayMonth.getFullYear(), displayMonth.getMonth(), day))
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
              {(() => {
                try {
                  if (selectedDate && typeof (selectedDate as any).toLocaleDateString === 'function') {
                    return selectedDate.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  }
                } catch (e) {}
                return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
              })()}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-center pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    )
  } catch (err) {
    try { console.error('[DatePicker] render error', err) } catch (e) {}
    // Flip a persistent render error flag so subsequent renders show a
    // small non-crashing fallback instead of repeatedly throwing.
    try { setRenderError(true) } catch (e) {}
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full max-w-sm p-6">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="p-4 text-center">
            <div className="text-sm text-on-surface-variant">An error occurred while showing the date picker.</div>
            <div className="text-xs text-muted-foreground mt-2">Try again or pick a date using the header controls.</div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }
}
