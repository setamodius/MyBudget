import { Home, PlusCircle, BarChart2, CalendarDays, Settings, ShoppingCart, Wallet, List, GitFork } from "lucide-react"

export const NAV_ITEMS = [
  { to: "/",            label: "Bugün",       icon: Home,        end: true,  primary: true  },
  { to: "/ekle",        label: "İşlem Ekle",  icon: PlusCircle,  end: false, primary: true  },
  { to: "/hesaplar",    label: "Hesaplar",    icon: Wallet,      end: false, primary: true  },
  { to: "/harcamalar",  label: "Harcamalar",  icon: ShoppingCart,end: false, primary: true  },
  { to: "/raporlar",    label: "Raporlar",    icon: BarChart2,   end: false, primary: true  },
  { to: "/plan",        label: "Plan",        icon: CalendarDays,end: false, primary: false },
  { to: "/akis",        label: "Para Akışı",  icon: GitFork,     end: false, primary: false },
  { to: "/islemler",    label: "İşlemler",    icon: List,        end: false, primary: false },
  { to: "/ayarlar",     label: "Ayarlar",     icon: Settings,    end: false, primary: false },
]
