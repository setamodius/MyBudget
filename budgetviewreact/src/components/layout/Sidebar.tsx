import { useEffect, useState } from "react"
import { NavLink } from "react-router-dom"
import { Sun, Moon, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { NAV_ITEMS } from "./navItems"

function useTheme() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  )
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark)
    localStorage.setItem("theme", isDark ? "dark" : "light")
  }, [isDark])
  return { isDark, toggle: () => setIsDark((d) => !d) }
}

export function Sidebar() {
  const { isDark, toggle } = useTheme()

  return (
    <aside className="flex h-full w-64 flex-col bg-card border-r border-border">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm">
          <Wallet className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-base font-semibold">Bütçe</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary/10 text-primary border-l-2 border-primary pl-[10px]"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground border-l-2 border-transparent pl-[10px]"
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-border">
        <button
          onClick={toggle}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-all pl-[10px]"
        >
          {isDark
            ? <Sun className="h-4 w-4 shrink-0" />
            : <Moon className="h-4 w-4 shrink-0" />}
          {isDark ? "Açık Tema" : "Koyu Tema"}
        </button>
        <p className="px-3 pt-2 text-[10px] text-muted-foreground/60">v{__APP_VERSION__}</p>
      </div>
    </aside>
  )
}
