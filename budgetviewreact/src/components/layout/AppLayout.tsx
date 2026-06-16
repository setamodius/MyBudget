import { Outlet, useLocation } from "react-router-dom"
import { Wallet } from "lucide-react"
import { Sidebar } from "./Sidebar"
import { BottomNav } from "./BottomNav"
import { NAV_ITEMS } from "./navItems"

function usePageLabel() {
  const { pathname } = useLocation()
  const match = NAV_ITEMS.find((i) =>
    i.end ? pathname === i.to : pathname === i.to || pathname.startsWith(i.to + "/")
  )
  return match?.label ?? "Bütçe"
}

export function AppLayout() {
  const pageLabel = usePageLabel()

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <div className="hidden lg:flex lg:shrink-0 print:hidden">
        <Sidebar />
      </div>

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <header className="flex lg:hidden print:hidden items-center justify-between px-4 h-14 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
              <Wallet className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">Bütçe</span>
          </div>
          <span className="text-sm font-medium text-muted-foreground">{pageLabel}</span>
        </header>

        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <Outlet />
        </main>
      </div>

      <BottomNav />
    </div>
  )
}
