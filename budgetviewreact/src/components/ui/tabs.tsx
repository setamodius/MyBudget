import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
  variant?: "pill" | "underline"
}

const TabsContext = React.createContext<TabsContextValue>({
  value: "",
  onValueChange: () => {},
  variant: "pill",
})

interface TabsProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  className?: string
  variant?: "pill" | "underline"
}

const Tabs = ({ value, onValueChange, children, className, variant = "pill" }: TabsProps) => (
  <TabsContext.Provider value={{ value, onValueChange, variant }}>
    <div className={cn("w-full", className)}>{children}</div>
  </TabsContext.Provider>
)

const TabsList = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const { variant } = React.useContext(TabsContext)
  return (
    <div
      className={cn(
        variant === "underline"
          ? "flex border-b border-border gap-1"
          : "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

const TabsTrigger = ({ value, className, children, ...props }: TabsTriggerProps) => {
  const { value: activeValue, onValueChange, variant } = React.useContext(TabsContext)
  const isActive = activeValue === value

  if (variant === "underline") {
    return (
      <button
        onClick={() => onValueChange(value)}
        className={cn(
          "px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px",
          isActive
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }

  return (
    <button
      onClick={() => onValueChange(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        isActive ? "bg-background text-foreground shadow" : "hover:bg-background/50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

const TabsContent = ({ value, className, ...props }: TabsContentProps) => {
  const { value: activeValue } = React.useContext(TabsContext)
  if (activeValue !== value) return null
  return <div className={cn("mt-4 animate-fade-in", className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
