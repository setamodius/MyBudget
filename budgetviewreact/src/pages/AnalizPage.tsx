import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Printer } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { usePrint } from "@/lib/print"
import { cn } from "@/lib/utils"
import { ButceAnalizi, PastaGrafik, KategoriTrendi } from "@/pages/HarcamalarPage"
import { AylikOzet, DonemOzeti } from "@/pages/RaporlarPage"
import { FlowContent } from "@/pages/FlowPage"

// Harcamalar + Raporlar + Para Akışı tek sayfada.
// Sekme adreste tutulur (?tab=...) ki eski adresler doğru sekmeye yönlensin.
const TABS = [
  { key: "butce",       label: "Bütçe",       hint: "Kategori bazında bütçe ve harcanan" },
  { key: "kategoriler", label: "Kategoriler", hint: "Harcamanın dağılımı ve aylık trendi" },
  { key: "raporlar",    label: "Raporlar",    hint: "Aylık ve dönemsel gelir-gider özeti" },
  { key: "akis",        label: "Para Akışı",  hint: "Gelirin nereye gittiği" },
] as const
type TabKey = typeof TABS[number]["key"]

function todayMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function AnalizPage() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.some(t => t.key === params.get("tab")) ? params.get("tab") : "butce") as TabKey
  const setTab = (t: string) => setParams({ tab: t }, { replace: true })

  const [month, setMonth] = useState(todayMonth)
  const [report, setReport] = useState<"aylik" | "donem">("aylik")
  const { handlePrint } = usePrint()
  const showMonth = tab === "butce" || tab === "kategoriler"

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10 print:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Analiz</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{TABS.find(t => t.key === tab)?.hint}</p>
          </div>
          {showMonth && (
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="text-sm font-medium bg-muted/60 border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
            />
          )}
          {tab === "raporlar" && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              PDF
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <Tabs value={tab} onValueChange={setTab} variant="underline">
          <TabsList className="mb-5 print:hidden">
            {TABS.map(t => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
          </TabsList>

          <TabsContent value="butce">
            <ButceAnalizi month={month} />
          </TabsContent>

          <TabsContent value="kategoriler">
            <div className="space-y-6">
              <PastaGrafik month={month} />
              <KategoriTrendi />
            </div>
          </TabsContent>

          <TabsContent value="raporlar">
            <div className="inline-flex rounded-lg border border-border p-0.5 mb-4 print:hidden">
              {([["aylik", "Aylık Özet"], ["donem", "Dönem Özeti"]] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setReport(k)}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                    report === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {report === "aylik" ? <AylikOzet /> : <DonemOzeti />}
          </TabsContent>

          <TabsContent value="akis">
            <FlowContent />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
