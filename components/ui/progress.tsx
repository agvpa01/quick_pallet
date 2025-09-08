"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number | null
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(({ className, value, ...props }, ref) => {
  const pct = typeof value === "number" ? Math.max(0, Math.min(100, value)) : null
  return (
    <div ref={ref} className={cn("relative h-2 w-full overflow-hidden rounded-full bg-secondary", className)} {...props}>
      <div
        className={cn(
          "h-full w-full flex-1 transform-gpu rounded-full bg-primary transition-all",
          pct === null && "animate-[shimmer_1.8s_infinite] origin-left -translate-x-full",
        )}
        style={pct === null ? undefined : { width: `${pct}%` }}
      />
      <style jsx>{`
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%);} }
      `}</style>
    </div>
  )
})
Progress.displayName = "Progress"

export { Progress }

