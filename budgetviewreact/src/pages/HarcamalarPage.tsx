import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { getBoxReport, getAllBoxReport, getMonthlyExpenseBreakdown } from "@/api/reports"
import { getBoxes } from "@/api/boxes"
import { getTransactions } from "@/api/transactions"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatMonth } from "@/lib/utils"
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { ChevronDown, ChevronRight, BarChart2 } from "lucide-react"
import type { BoxReport } from "@/types"

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  color: "hsl(var(--foreground))",
  borderRadius: "8px",
  fontSize: "12px",
}

const PIE_COLORS = [
  "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF",
  "#FF9F40", "#C9CBCF", "#7BC8A4", "#E7754D", "#4169E1",
  "#FFD700", "#8B008B", "#00CED1", "#DC143C", "#FF8C00",
]

function todayMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

// ---------------------------------------------------------------------------
// Pasta Grafik — aylık harcama dağılımı
// ---------------------------------------------------------------------------
function PastaGrafik({ month }: { month: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["expense-breakdown", month],
    queryFn: () => getMonthlyExpenseBreakdown(month),
    enabled: !!month,
  })

  const total = data.reduce((s, r) => s + parseFloat(r.total), 0)
  const pieData = data.map((r, i) => ({
    name: r.name,
    value: parseFloat(r.total),
    color: PIE_COLORS[i % PIE_COLORS.length],
    percent: total > 0 ? ((parseFloat(r.total) / total) * 100).toFixed(1) : "0",
  }))

  if (isLoading) {
    return <div className="h-48 rounded-xl bg-muted animate-pulse" />
  }

  if (pieData.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        <BarChart2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Bu ay için harcama verisi yok</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <Card className="flex-1">
        <CardContent className="pt-4 flex items-center justify-center">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} innerRadius={44}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="flex-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Toplam: {formatCurrency(total)}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="pb-2 text-left font-medium">Kategori</th>
                <th className="pb-2 text-right font-medium">Tutar</th>
                <th className="pb-2 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {pieData.map(item => (
                <tr key={item.name} className="hover:bg-muted/20">
                  <td className="py-2 flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                    {item.name}
                  </td>
                  <td className="py-2 text-right font-mono">{formatCurrency(item.value)}</td>
                  <td className="py-2 text-right text-muted-foreground">%{item.percent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Kategori Trendi — aylık kategori bazlı harcama tablosu
// ---------------------------------------------------------------------------
const MONTH_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"]

function KategoriTrendi() {
  const [selectedId, setSelectedId]       = useState("")
  const [expandedYear, setExpandedYear]   = useState<string | null>(null)
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)
  const [chartYear, setChartYear]         = useState("")

  const { data: boxes = [] } = useQuery({ queryKey: ["boxes", "expensetypes"], queryFn: () => getBoxes("expensetypes") })

  const reportQuery = useQuery({
    queryKey: ["report", "expensetypes", selectedId],
    queryFn: () => selectedId ? getBoxReport("expensetypes", parseInt(selectedId)) : getAllBoxReport("expensetypes"),
    enabled: true,
  })

  const reports: BoxReport[] = reportQuery.data ?? []

  const yearlyReports = useMemo(() => {
    const map = new Map<string, { year: string; cash: number; cc_this_cycle: number; cc_next_cycle: number; total: number; months: BoxReport[] }>()
    for (const r of reports) {
      const year = String(new Date(r.month).getFullYear())
      if (!map.has(year)) {
        map.set(year, { year, cash: 0, cc_this_cycle: 0, cc_next_cycle: 0, total: 0, months: [] })
      }
      const y = map.get(year)!
      y.cash           += parseFloat(r.cash ?? "0")
      y.cc_this_cycle  += parseFloat(r.cc_this_cycle ?? "0")
      y.cc_next_cycle  += parseFloat(r.cc_next_cycle ?? "0")
      y.total          += parseFloat(r.charged ?? r.income ?? "0")
      y.months.push(r)
    }
    return Array.from(map.values()).sort((a, b) => a.year.localeCompare(b.year))
  }, [reports])

  const txQuery = useQuery({
    queryKey: ["tx-detail", "expensetypes", selectedId, expandedMonth],
    queryFn: () => {
      if (!expandedMonth || !selectedId) return []
      const start = expandedMonth.slice(0, 10)
      const d = new Date(start + "T12:00:00")
      d.setMonth(d.getMonth() + 1)
      d.setDate(0)
      const end = d.toISOString().split("T")[0]
      return getTransactions({ start, end, to: parseInt(selectedId) })
    },
    enabled: !!expandedMonth && !!selectedId,
  })

  const handleSelectChange = (val: string) => {
    setSelectedId(val)
    setExpandedYear(null)
    setExpandedMonth(null)
  }

  const canExpand = !!selectedId
  const boxOptions = [{ value: "", label: "Tümü" }, ...boxes.map(b => ({ value: String(b.id), label: b.name }))]
  const yearOptions = yearlyReports.map(y => ({ value: y.year, label: y.year }))
  const activeYear = chartYear || yearlyReports[yearlyReports.length - 1]?.year || ""

  const chartData = Array.from({ length: 12 }, (_, i) => {
    const r = activeYear
      ? reports.find(rep => {
          const d = new Date(rep.month)
          return String(d.getFullYear()) === activeYear && d.getMonth() === i
        })
      : undefined
    return {
      name: MONTH_SHORT[i],
      Nakit:           parseFloat(r?.cash ?? "0"),
      "KK Bu Döngü":   parseFloat(r?.cc_this_cycle ?? "0"),
      "KK Sonraki":    parseFloat(r?.cc_next_cycle ?? "0"),
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-48">
          <Select options={boxOptions} value={selectedId} onChange={handleSelectChange} placeholder="Tümü" />
        </div>
        <div className="w-32">
          <Select options={yearOptions} value={activeYear} onChange={setChartYear} placeholder="Yıl" />
        </div>
        {!selectedId && <span className="text-xs text-muted-foreground">Ay detayı için belirli bir kategori seçin</span>}
      </div>

      {activeYear && (
        <Card>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: number) => `₺${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="Nakit"          stackId="a" fill="#a855f7" radius={[0, 0, 0, 0]} />
                <Bar dataKey="KK Bu Döngü"   stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                <Bar dataKey="KK Sonraki"    stackId="a" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="px-4 py-2.5 w-6"></th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Yıl</th>
                {["Toplam", "Nakit", "KK Bu Döngü", "KK Sonraki Ay"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {reportQuery.isLoading && [...Array(4)].map((_, i) => (
                <tr key={i}>{[...Array(6)].map((__, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-3.5 rounded bg-muted animate-pulse" /></td>
                ))}</tr>
              ))}
              {yearlyReports.map(y => {
                const yearKey  = y.year
                const yearOpen = expandedYear === yearKey
                const ccNext   = y.cc_next_cycle
                return (
                  <>
                    <tr
                      key={yearKey}
                      className="hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => setExpandedYear(yearOpen ? null : yearKey)}
                    >
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {yearOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-sm">{y.year}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm font-semibold">{formatCurrency(y.total)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm text-purple-500">{formatCurrency(y.cash)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm text-amber-500">{formatCurrency(y.cc_this_cycle)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono text-sm font-medium ${ccNext > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                        {formatCurrency(ccNext)}
                      </td>
                    </tr>
                    {yearOpen && (
                      <tr key={`${yearKey}-months`}>
                        <td colSpan={6} className="bg-muted/10 px-4 py-2 border-b border-border/50">
                          <table className="w-full text-xs">
                            <tbody className="divide-y divide-border/30">
                              {y.months.map(r => {
                                const monthKey  = r.month
                                const monthOpen = expandedMonth === monthKey
                                const mTotal    = parseFloat(r.charged ?? r.income ?? "0")
                                const mCcNext   = parseFloat(r.cc_next_cycle ?? "0")
                                return (
                                  <>
                                    <tr
                                      key={monthKey}
                                      className={`hover:bg-muted/20 transition-colors ${canExpand ? "cursor-pointer" : ""}`}
                                      onClick={() => canExpand && setExpandedMonth(monthOpen ? null : monthKey)}
                                    >
                                      <td className="py-2 w-6 text-muted-foreground">
                                        {canExpand && (monthOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
                                      </td>
                                      <td className="py-2 font-medium">{formatMonth(r.month)}</td>
                                      <td className="py-2 text-right font-mono font-semibold">{formatCurrency(mTotal)}</td>
                                      <td className="py-2 text-right font-mono text-purple-500">{formatCurrency(r.cash ?? "0")}</td>
                                      <td className="py-2 text-right font-mono text-amber-500">{formatCurrency(r.cc_this_cycle ?? "0")}</td>
                                      <td className={`py-2 text-right font-mono font-medium ${mCcNext > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                                        {formatCurrency(mCcNext)}
                                      </td>
                                    </tr>
                                    {monthOpen && canExpand && (
                                      <tr key={`${monthKey}-detail`}>
                                        <td colSpan={6} className="bg-muted/20 px-4 py-3">
                                          {txQuery.isLoading ? (
                                            <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-3 rounded bg-muted animate-pulse" />)}</div>
                                          ) : txQuery.data?.length === 0 ? (
                                            <p className="text-xs text-muted-foreground text-center py-2">Bu ay işlem yok</p>
                                          ) : (
                                            <table className="w-full text-xs">
                                              <thead>
                                                <tr className="text-muted-foreground border-b border-border/40">
                                                  <th className="text-left pb-2 font-medium">Tarih</th>
                                                  <th className="text-left pb-2 font-medium">Açıklama</th>
                                                  <th className="text-right pb-2 font-medium">Tutar</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-border/30">
                                                {txQuery.data?.map(tx => (
                                                  <tr key={tx.id} className="hover:bg-muted/10">
                                                    <td className="py-1.5 font-mono text-muted-foreground">{tx.date}</td>
                                                    <td className="py-1.5">{tx.description}</td>
                                                    <td className="py-1.5 text-right font-mono font-medium">{formatCurrency(tx.amount)}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          )}
                                        </td>
                                      </tr>
                                    )}
                                  </>
                                )
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
              {!reportQuery.isLoading && reports.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <BarChart2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Veri bulunamadı</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bütçe Analizi
// ---------------------------------------------------------------------------
function ButceAnalizi({ month }: { month: string }) {
  const [y, m] = month.split("-").map(Number)
  const monthStart = `${month}-01`
  const monthEnd   = new Date(y, m, 0).toISOString().split("T")[0]

  const { data: expenseBoxes = [] } = useQuery({
    queryKey: ["boxes", "expensetypes"],
    queryFn: () => getBoxes("expensetypes"),
  })
  const { data: destroyers = [] } = useQuery({
    queryKey: ["boxes", "destroyers"],
    queryFn: () => getBoxes("destroyers"),
  })
  const { data: storageBoxes = [] } = useQuery({
    queryKey: ["boxes", "storages"],
    queryFn: () => getBoxes("storages"),
  })
  const { data: monthTx = [], isLoading } = useQuery({
    queryKey: ["transactions", "butce-analizi", month],
    queryFn: () => getTransactions({ start: monthStart, end: monthEnd }),
    enabled: !!month,
  })

  const expenseIdSet   = useMemo(() => new Set(expenseBoxes.map(b => b.id)), [expenseBoxes])
  const destroyerIdSet = useMemo(() => new Set(destroyers.map(b => b.id)), [destroyers])
  const storageIdSet   = useMemo(() => new Set(storageBoxes.map(b => b.id)), [storageBoxes])

  const actualMap = useMemo(() => {
    const map: Record<number, number> = {}
    for (const tx of monthTx) {
      if (expenseIdSet.has(tx.tobox)) {
        map[tx.tobox] = (map[tx.tobox] ?? 0) + parseFloat(tx.amount)
      } else if (expenseIdSet.has(tx.frombox) && storageIdSet.has(tx.tobox)) {
        map[tx.frombox] = (map[tx.frombox] ?? 0) - parseFloat(tx.amount)
      }
    }
    return map
  }, [monthTx, expenseIdSet, storageIdSet])

  const budgetMap = useMemo(() => {
    const map: Record<number, number> = {}
    for (const tx of monthTx) {
      if (!expenseIdSet.has(tx.frombox) || !destroyerIdSet.has(tx.tobox)) continue
      if (tx.info?.type !== "budget") continue
      map[tx.frombox] = (map[tx.frombox] ?? 0) + parseFloat(tx.amount)
    }
    return map
  }, [monthTx, expenseIdSet, destroyerIdSet])

  const installmentMap = useMemo(() => {
    const map: Record<number, number> = {}
    for (const tx of monthTx) {
      if (!expenseIdSet.has(tx.frombox) || !destroyerIdSet.has(tx.tobox)) continue
      if (!tx.info?.plan_id) continue
      map[tx.frombox] = (map[tx.frombox] ?? 0) + parseFloat(tx.amount)
    }
    return map
  }, [monthTx, expenseIdSet, destroyerIdSet])

  const rows = useMemo(() => expenseBoxes.map(box => {
    const actual      = actualMap[box.id] ?? 0
    const budgetEntry = budgetMap[box.id] ?? null
    const installment = installmentMap[box.id] ?? 0
    const ceiling     = budgetEntry ?? (box.pluslimit ? parseFloat(String(box.pluslimit)) : null)
    const remaining   = ceiling !== null ? ceiling - actual : null
    const free        = remaining !== null ? Math.max(0, remaining - installment) : null
    const pct         = ceiling && ceiling > 0 ? Math.min((actual / ceiling) * 100, 100) : null
    const over        = ceiling !== null && actual > ceiling
    return { box, actual, ceiling, installment, budgetEntry, remaining, free, pct, over }
  }), [expenseBoxes, actualMap, budgetMap, installmentMap])

  const totalActual    = rows.reduce((s, r) => s + r.actual, 0)
  const totalCeiling   = rows.reduce((s, r) => s + (r.ceiling ?? 0), 0)
  const totalRemaining = totalCeiling - totalActual
  const totalOver      = totalCeiling > 0 && totalActual > totalCeiling

  if (isLoading) {
    return <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
  }

  return (
    <div className="space-y-3">
      {/* Özet */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Bütçe",    value: totalCeiling,   color: "text-purple-500", hint: "aylık plan" },
          { label: "Harcanan", value: totalActual,    color: "text-foreground", hint: "takvim ayı, taksitler dahil" },
          { label: "Kalan",    value: totalRemaining, color: totalOver ? "text-red-500" : "text-emerald-500", hint: "bütçe − harcanan" },
        ].map(({ label, value, color, hint }) => (
          <div key={label} className="rounded-xl border border-border p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
            <p className={`text-sm font-bold font-mono ${color}`}>{formatCurrency(value)}</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{hint}</p>
          </div>
        ))}
      </div>

      {/* Kategori kartları */}
      {rows.map(({ box, actual, ceiling, installment, budgetEntry, remaining, free, pct, over }) => {
        const barColor = !pct ? "bg-muted-foreground/20" : over ? "bg-red-500" : "bg-emerald-500"

        return (
          <div key={box.id} className={`rounded-xl border p-4 space-y-2.5 ${over ? "border-red-500/30 bg-red-500/3" : "border-border"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">{box.name}</span>
                {!budgetEntry && ceiling && (
                  <span className="text-[10px] text-muted-foreground/50">(limit)</span>
                )}
              </div>
              <div className="text-right leading-tight">
                <span className={`text-sm font-semibold font-mono ${over ? "text-red-500" : "text-foreground"}`}>
                  {formatCurrency(actual)}
                </span>
                {ceiling && (
                  <span className="text-xs text-muted-foreground font-mono"> / {formatCurrency(ceiling)}</span>
                )}
              </div>
            </div>

            {ceiling ? (
              <>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct ?? 0}%` }} />
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {installment > 0 && (
                      <span>
                        <span className="text-amber-500 font-medium">{formatCurrency(installment)}</span> taksit
                      </span>
                    )}
                    {installment > 0 && free !== null && free > 0 && (
                      <span>· <span className="text-emerald-600 font-medium">{formatCurrency(free)}</span> serbest</span>
                    )}
                  </div>
                  <span className={`font-medium ${over ? "text-red-500" : "text-muted-foreground"}`}>
                    {over
                      ? `${formatCurrency(actual - ceiling)} aşıldı`
                      : remaining !== null
                      ? `${formatCurrency(remaining)} kaldı`
                      : ""}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                {actual > 0 ? `${formatCurrency(actual)} harcandı — bütçe tanımlanmamış` : "Bütçe veya limit tanımlanmamış"}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// HarcamalarPage
// ---------------------------------------------------------------------------
export function HarcamalarPage() {
  const [month, setMonth] = useState(todayMonth)
  const [tab, setTab] = useState("butce")

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Harcamalar</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Kategori dağılımı ve aylık trendler</p>
          </div>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="text-sm font-medium bg-muted/60 border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <Tabs value={tab} onValueChange={setTab} variant="underline">
          <TabsList className="mb-5">
            <TabsTrigger value="butce">Bütçe</TabsTrigger>
            <TabsTrigger value="dagilim">Dağılım</TabsTrigger>
            <TabsTrigger value="trend">Trend</TabsTrigger>
          </TabsList>

          <TabsContent value="butce">
            <ButceAnalizi month={month} />
          </TabsContent>

          <TabsContent value="dagilim">
            <PastaGrafik month={month} />
          </TabsContent>

          <TabsContent value="trend">
            <KategoriTrendi />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
