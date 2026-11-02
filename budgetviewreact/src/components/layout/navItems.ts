import { Home, PlusCircle, BarChart2, CalendarDays, Settings, Wallet, List } from "lucide-react"

// group: masaüstü kenar çubuğundaki başlık (null = alt bölüm)
// primary: mobil alt menüde doğrudan görünür; diğerleri "Daha Fazla" altında
export const NAV_ITEMS = [
  { to: "/",            label: "Bugün",       icon: Home,         end: true,  primary: true,  group: "Günlük"   },
  { to: "/islemler",    label: "İşlemler",    icon: List,         end: false, primary: true,  group: "Günlük"   },
  { to: "/ekle",        label: "İşlem Ekle",  icon: PlusCircle,   end: false, primary: true,  group: "Günlük"   },
  { to: "/hesaplar",    label: "Hesaplar",    icon: Wallet,       end: false, primary: true,  group: "Günlük"   },
  { to: "/analiz",      label: "Analiz",      icon: BarChart2,    end: false, primary: false, group: "Analiz ve Plan" },
  { to: "/plan",        label: "Plan",        icon: CalendarDays, end: false, primary: false, group: "Analiz ve Plan" },
  { to: "/ayarlar",     label: "Ayarlar",     icon: Settings,     end: false, primary: false, group: null       },
]

export const NAV_GROUPS = ["Günlük", "Analiz ve Plan"] as const
