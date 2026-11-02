import { useEffect, useState } from "react"
import { NavLink } from "react-router-dom"
import { Sun, Moon, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { NAV_ITEMS, NAV_GROUPS } from "./navItems"

function SideLink({ to, label, icon: Icon, end }: (typeof NAV_ITEMS)[number]) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all border-l-2 pl-[10px]",
          isActive
            ? "bg-primary/10 text-primary border-primary"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground border-transparent"
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </NavLink>
  )
}

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

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group} className="space-y-0.5">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{group}</p>
            {NAV_ITEMS.filter((i) => i.group === group).map((item) => <SideLink key={item.to} {...item} />)}
          </div>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-border space-y-0.5">
        {NAV_ITEMS.filter((i) => i.group === null).map((item) => <SideLink key={item.to} {...item} />)}
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
