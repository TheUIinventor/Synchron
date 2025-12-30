import React from 'react'

type Props = {
  className?: string
  rows?: number
}

export default function HolidayShimmer({ className = '', rows = 10 }: Props) {
  const items = Array.from({ length: rows })
  return (
    <div className={`w-full ${className}`}>
      <div className="animate-pulse">
        <div className="space-y-3">
          {items.map((_, i) => (
            <div key={i} className="h-12 bg-surface-variant rounded-md" />
          ))}
        </div>
      </div>
    </div>
  )
}
