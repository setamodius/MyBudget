import { Home, PlusCircle, BarChart2, CalendarDays, Settings, ShoppingCart, Wallet, List, GitFork } from "lucide-react"

// group: masaüstü kenar çubuğundaki başlık (null = alt bölüm)
// primary: mobil alt menüde doğrudan görünür; diğerleri "Daha Fazla" altında
export const NAV_ITEMS = [
  { to: "/",            label: "Bugün",       icon: Home,         end: true,  primary: true,  group: "Günlük"   },
  { to: "/islemler",    label: "İşlemler",    icon: List,         end: false, primary: true,  group: "Günlük"   },
  { to: "/ekle",        label: "İşlem Ekle",  icon: PlusCircle,   end: false, primary: true,  group: "Günlük"   },
  { to: "/hesaplar",    label: "Hesaplar",    icon: Wallet,       end: false, primary: true,  group: "Günlük"   },
  { to: "/harcamalar",  label: "Harcamalar",  icon: ShoppingCart, end: false, primary: false, group: "Analiz"   },
  { to: "/raporlar",    label: "Raporlar",    icon: BarChart2,    end: false, primary: false, group: "Analiz"   },
  { to: "/akis",        label: "Para Akışı",  icon: GitFork,      end: false, primary: false, group: "Analiz"   },
  { to: "/plan",        label: "Plan",        icon: CalendarDays, end: false, primary: false, group: "Planlama" },
  { to: "/ayarlar",     label: "Ayarlar",     icon: Settings,     end: false, primary: false, group: null       },
]

export const NAV_GROUPS = ["Günlük", "Analiz", "Planlama"] as const
