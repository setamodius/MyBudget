import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getFlows, type Flow } from "@/api/flows"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, monthsAgo, today } from "@/lib/utils"
import { GitFork } from "lucide-react"

const TYPE_LABELS: Record<string, string> = {
  Income:     "Gelir",
  Storage:    "Hesap",
  Investment: "Yatırım",
  CreditCard: "Kredi Kartı",
  ExpenseType:"Gider",
}

const PERIODS = [
  { label: "Ay Başından Beri", getRange: () => ({ start: monthsAgo(0),  end: today() }) },
  { label: "Son 3 Ay",  getRange: () => ({ start: monthsAgo(2),  end: today() }) },
  { label: "Son 12 Ay", getRange: () => ({ start: monthsAgo(11), end: today() }) },
  { label: "Tümü",      getRange: () => ({ start: undefined,     end: undefined }) },
]

function sumFlows(flows: Flow[], fromType: string, toType: string): number {
  return flows
    .filter(f => f.from_type === fromType && f.to_type === toType)
    .reduce((s, f) => s + parseFloat(f.total), 0)
}

function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full transition-all ${className}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function FlowPage() {
  const [periodIdx, setPeriodIdx] = useState(0)
  const { start, end } = PERIODS[periodIdx].getRange()

  const { data: flows = [], isLoading, error } = useQuery({
    queryKey: ["flows", start, end],
    queryFn:  () => getFlows(start, end),
  })

  const visibleFlows = useMemo(
    () => flows.filter(f =>
      f.from_type !== "Generator" &&
      f.to_type   !== "Destroyer" &&
      !(f.from_type === "ExpenseType" && f.to_type === "Storage")
    ),
    [flows]
  )

  // İade akışları (ExpenseType → Storage) — gider toplamlarından düşülür
  const refundFlows = useMemo(
    () => flows.filter(f => f.from_type === "ExpenseType" && f.to_type === "Storage"),
    [flows]
  )
  const refundByBox = useMemo(() => {
    const map: Record<number, number> = {}
    for (const f of refundFlows) map[f.frombox] = (map[f.frombox] ?? 0) + parseFloat(f.total)
    return map
  }, [refundFlows])
  const totalRefunds = useMemo(
    () => refundFlows.reduce((s, f) => s + parseFloat(f.total), 0),
    [refundFlows]
  )

  // Gelir dağılımı
  const income       = useMemo(() => sumFlows(visibleFlows, "Income",     "Storage"),    [visibleFlows])
  const kkOdeme      = useMemo(() => sumFlows(visibleFlows, "Storage",    "CreditCard"), [visibleFlows])
  const nakitGider   = useMemo(() => sumFlows(visibleFlows, "Storage",    "ExpenseType") - totalRefunds, [visibleFlows, totalRefunds])
  const yatirimGiren = useMemo(() => sumFlows(visibleFlows, "Storage", "Investment") + sumFlows(visibleFlows, "CreditCard", "Investment"), [visibleFlows])
  const yatirimCikan = useMemo(() => sumFlows(visibleFlows, "Investment", "Storage"), [visibleFlows])
  const netYatirim    = useMemo(() => yatirimGiren - yatirimCikan, [yatirimGiren, yatirimCikan])
  const kalan         = useMemo(() => income - kkOdeme - nakitGider - netYatirim, [income, kkOdeme, nakitGider, netYatirim])

  const incomeRows = useMemo(() => [
    { label: "KK Ödeme",    value: kkOdeme,   hint: "Hesap → Kredi Kartı",  bar: "bg-amber-500",   text: "text-amber-500"   },
    { label: "Nakit Gider", value: nakitGider, hint: "Hesap → Gider (net)",  bar: "bg-purple-500",  text: "text-purple-500"  },
    { label: "Net Yatırım", value: netYatirim, hint: "Hesap → Yatırım (net)",bar: "bg-violet-500",  text: "text-violet-500"  },
    { label: "Hesaplarda",  value: kalan,      hint: "Hesaplarda kalan",     bar: "bg-emerald-500", text: "text-emerald-500" },
  ].filter(r => r.value > 0), [kkOdeme, nakitGider, netYatirim, kalan])

  // Gider kategorileri — iadeler düşülmüş net tutar
  const expenseByCategory = useMemo(() => {
    const map: Record<number, { name: string; amount: number }> = {}
    for (const f of visibleFlows) {
      if (f.to_type !== "ExpenseType") continue
      if (!map[f.tobox]) map[f.tobox] = { name: f.to_name, amount: 0 }
      map[f.tobox].amount += parseFloat(f.total)
    }
    for (const [boxId, refund] of Object.entries(refundByBox)) {
      if (map[Number(boxId)]) map[Number(boxId)].amount -= refund
    }
    return Object.values(map).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount)
  }, [visibleFlows, refundByBox])

  const totalExpense = useMemo(
    () => expenseByCategory.reduce((s, c) => s + c.amount, 0),
    [expenseByCategory]
  )

  const hasData = visibleFlows.length > 0

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <h1 className="text-xl font-semibold">Para Akışı</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Gelirin nereye gittiği</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Dönem seçici */}
        <div className="flex items-center gap-2">
          {PERIODS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setPeriodIdx(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                periodIdx === i
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4">
              <p className="text-sm text-destructive">Veriler yüklenemedi.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !hasData && !error && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <GitFork className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Bu dönemde işlem bulunamadı</p>
            </CardContent>
          </Card>
        )}

        {(isLoading || hasData) && (
          <>
            {/* Gelir Dağılımı */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Gelir Dağılımı
                  </CardTitle>
                  {!isLoading && income > 0 && (
                    <span className="text-lg font-bold font-mono">{formatCurrency(income)}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  [...Array(4)].map((_, i) => <div key={i} className="h-9 rounded bg-muted animate-pulse" />)
                ) : income === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Bu dönemde gelir kaydedilmemiş
                  </p>
                ) : (
                  incomeRows.map(({ label, value, hint, bar, text }) => {
                    const pct = (value / income) * 100
                    return (
                      <div key={label} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-baseline gap-2">
                            <span className="font-medium">{label}</span>
                            <span className="text-xs text-muted-foreground">{hint}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs font-semibold ${text}`}>{pct.toFixed(1)}%</span>
                            <span className="font-mono font-semibold w-24 text-right">{formatCurrency(value)}</span>
                          </div>
                        </div>
                        <Bar value={value} max={income} className={bar} />
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>

            {/* Gider Dökümü */}
            {(isLoading || expenseByCategory.length > 0) && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Gider Dökümü
                    </CardTitle>
                    {!isLoading && totalExpense > 0 && (
                      <span className="text-lg font-bold font-mono">{formatCurrency(totalExpense)}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoading ? (
                    [...Array(4)].map((_, i) => <div key={i} className="h-9 rounded bg-muted animate-pulse" />)
                  ) : (
                    expenseByCategory.map(cat => {
                      const pct = totalExpense > 0 ? (cat.amount / totalExpense) * 100 : 0
                      return (
                        <div key={cat.name} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{cat.name}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-semibold text-orange-500">{pct.toFixed(1)}%</span>
                              <span className="font-mono font-semibold w-24 text-right">{formatCurrency(cat.amount)}</span>
                            </div>
                          </div>
                          <Bar value={cat.amount} max={totalExpense} className="bg-orange-500" />
                        </div>
                      )
                    })
                  )}
                </CardContent>
              </Card>
            )}

            {/* Akış Detay Tablosu */}
            {visibleFlows.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Akış Detayı
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border">
                          {["Kaynak", "Hedef", "Tutar"].map(h => (
                            <th key={h} className={`px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide ${h === "Tutar" ? "text-right" : "text-left"}`}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {visibleFlows.map((f, i) => (
                          <tr key={i} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5">
                              <span className="font-medium">{f.from_name}</span>
                              <span className="text-xs text-muted-foreground ml-1.5">{TYPE_LABELS[f.from_type]}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="font-medium">{f.to_name}</span>
                              <span className="text-xs text-muted-foreground ml-1.5">{TYPE_LABELS[f.to_type]}</span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-medium">
                              {formatCurrency(f.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

      </div>
    </div>
  )
}
