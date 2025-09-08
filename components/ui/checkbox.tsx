import * as React from "react"
import { cn } from "@/lib/utils"

export type CheckboxProps = React.ComponentPropsWithoutRef<"input">

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        "h-5 w-5 rounded-md border border-input text-primary align-middle",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
})
Checkbox.displayName = "Checkbox"

