import { useState, useRef, useEffect } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { NAV_ITEMS } from "./navItems"

const PRIMARY = NAV_ITEMS.filter((i) => i.primary)
const SECONDARY = NAV_ITEMS.filter((i) => !i.primary)

export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  const isSecondaryActive = SECONDARY.some((i) =>
    i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)
  )

  useEffect(() => {
    if (!moreOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [moreOpen])

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border bg-card/95 backdrop-blur-sm lg:hidden print:hidden">
      {PRIMARY.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] font-medium transition-colors rounded-lg min-w-[44px]",
              isActive ? "text-primary" : "text-muted-foreground"
            )
          }
        >
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}

      <div ref={menuRef} className="relative flex flex-col items-center">
        {moreOpen && (
          <div className="absolute bottom-14 right-0 w-44 rounded-xl border border-border bg-card shadow-xl animate-scale-in overflow-hidden">
            {SECONDARY.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "text-primary bg-primary/8"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </NavLink>
            ))}
          </div>
        )}
        <button
          onClick={() => setMoreOpen((v) => !v)}
          className={cn(
            "flex flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] font-medium transition-colors rounded-lg min-w-[44px]",
            isSecondaryActive || moreOpen ? "text-primary" : "text-muted-foreground"
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          Daha Fazla
        </button>
      </div>
    </nav>
  )
}
