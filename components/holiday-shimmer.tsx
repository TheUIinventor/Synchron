import React from 'react'

export default function HolidayShimmer({ className = '' }: { className?: string }) {
  return (
    <div className={`w-full ${className}`}>
      <div className="animate-pulse">
        <div className="h-6 w-40 bg-surface-variant rounded-md mb-4" />
        <div className="space-y-2">
          <div className="h-12 bg-surface-container rounded-lg" />
          <div className="h-12 bg-surface-container rounded-lg" />
          <div className="h-12 bg-surface-container rounded-lg" />
        </div>
      </div>
    </div>
  )
}
