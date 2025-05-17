import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground dark:[&>svg]:text-dark-foreground [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground border-border dark:bg-dark-secondary dark:text-dark-secondary-foreground dark:border-dark-border",
        destructive:
          "border-destructive/50 text-destructive bg-destructive/10 dark:bg-dark-destructive/10 dark:border-dark-destructive dark:text-red-400 [&>svg]:text-destructive dark:[&>svg]:text-red-400",
        info:
          "border-blue-500/50 text-blue-700 bg-blue-500/10 dark:bg-blue-500/10 dark:border-blue-500/50 dark:text-blue-300 [&>svg]:text-blue-700 dark:[&>svg]:text-blue-300",
        warning:
          "border-warning/50 text-amber-700 bg-warning/10 dark:bg-warning/10 dark:border-warning/50 dark:text-amber-300 [&>svg]:text-amber-700 dark:[&>svg]:text-amber-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
