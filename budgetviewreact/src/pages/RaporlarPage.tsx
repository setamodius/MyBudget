import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { getSummaries, getPeriodSummary } from "@/api/reports"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { formatCurrency, formatMonth } from "@/lib/utils"
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { FileText, BarChart2 } from "lucide-react"
import type { PeriodSummaryRow } from "@/types"

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  color: "hsl(var(--foreground))",
  borderRadius: "8px",
  fontSize: "12px",
}

const TYPE_ORDER = ["Income", "Storage", "Investment", "CreditCard", "ExpenseType"]
const TYPE_LABELS: Record<string, string> = {
  Income: "Gelirler", Storage: "Banka / Nakit",
  Investment: "Yatırımlar", CreditCard: "Kredi Kartları", ExpenseType: "Gider Kategorileri",
}

function thisMonthRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const last = new Date(y, now.getMonth() + 1, 0).getDate()
  return { start: `${y}-${m}-01`, end: `${y}-${m}-${last}` }
}

// ---------------------------------------------------------------------------
// Aylık Özet
// ---------------------------------------------------------------------------
export function AylikOzet() {
  const { data: summaries = [], isLoading, error } = useQuery({
    queryKey: ["summaries"],
    queryFn: getSummaries,
  })

  const chartData = summaries.slice(-12).map(s => ({
    name: formatMonth(s.month),
    Gelir: parseFloat(s.t_income),
    "KK Gider": parseFloat(s.t_creditcard_expense),
    "Direkt Gider": parseFloat(s.t_direct_expense),
    "KK Bekleyen": parseFloat(s.t_cc_pending ?? "0"),
    Bakiye: parseFloat(s.balance),
  }))

  return (
    <div className="space-y-5">
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">Veriler yüklenemedi.</p>
          </CardContent>
        </Card>
      )}

      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Son {chartData.length} Ay — Gelir & Gider Trendi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: number) => `₺${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Line type="monotone" dataKey="Gelir" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="KK Gider" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Direkt Gider" stroke="#a855f7" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="KK Bekleyen" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                <Line type="monotone" dataKey="Bakiye" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: "#10b981" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                {["Ay", "Gelir", "KK Gideri", "Direkt Gider", "Toplam Gider", "KK Bekleyen", "Bakiye"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap first:text-left [&:not(:first-child)]:text-right">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading && [...Array(4)].map((_, i) => (
                <tr key={i}>
                  {[...Array(7)].map((__, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-3.5 rounded bg-muted animate-pulse" /></td>
                  ))}
                </tr>
              ))}
              {summaries.map(s => {
                const balance = parseFloat(s.balance)
                return (
                  <tr key={s.month} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-sm">{formatMonth(s.month)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm text-blue-500">{formatCurrency(s.t_income)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm text-amber-500">{formatCurrency(s.t_creditcard_expense)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm text-purple-500">{formatCurrency(s.t_direct_expense)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm text-muted-foreground">{formatCurrency(s.t_expense)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm text-red-400">{formatCurrency(s.t_cc_pending ?? "0")}</td>
                    <td className={`px-4 py-2.5 text-right font-mono text-sm font-semibold ${balance >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {formatCurrency(balance)}
                    </td>
                  </tr>
                )
              })}
              {!isLoading && summaries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Özet verisi yok</p>
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
// Dönem Özeti
// ---------------------------------------------------------------------------
export function DonemOzeti() {
  const [start, setStart] = useState("")
  const [end,   setEnd]   = useState("")

  const { data = [], isLoading } = useQuery({
    queryKey: ["period-summary", start, end],
    queryFn: () => getPeriodSummary({ start: start || undefined, end: end || undefined }),
  })

  const grouped = TYPE_ORDER
    .map(type => ({
      type,
      rows: data.filter((r: PeriodSummaryRow) =>
        r.type === type && (parseFloat(r.total_in) !== 0 || parseFloat(r.total_out) !== 0)
      ),
    }))
    .filter(g => g.rows.length > 0)

  const sum = (rows: PeriodSummaryRow[], field: keyof PeriodSummaryRow) =>
    rows.reduce((s, r) => s + parseFloat(r[field] as string || "0"), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="flex items-center gap-2">
          <Input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-36 text-sm" />
          <span className="text-muted-foreground text-xs">—</span>
          <Input type="date" value={end}   onChange={e => setEnd(e.target.value)}   className="w-36 text-sm" />
        </div>
        <button
          onClick={() => { const r = thisMonthRange(); setStart(r.start); setEnd(r.end) }}
          className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted/50 transition-colors"
        >
          Bu Ay
        </button>
        <button
          onClick={() => { setStart(""); setEnd("") }}
          className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted/50 transition-colors"
        >
          Tüm Zamanlar
        </button>
        {isLoading && <span className="text-xs text-muted-foreground animate-pulse">Yükleniyor...</span>}
      </div>

      {grouped.map(({ type, rows }) => {
        const totalIn  = sum(rows, "total_in")
        const totalOut = sum(rows, "total_out")
        const totalNet = sum(rows, "net")
        return (
          <div key={type} className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
            <div className="px-4 py-2 bg-muted/40 border-b border-border">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {TYPE_LABELS[type] ?? type}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Kutu</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Giren</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Çıkan</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.map(r => {
                  const net = parseFloat(r.net)
                  return (
                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{r.name}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-blue-500">{formatCurrency(r.total_in)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-orange-500">{formatCurrency(r.total_out)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono font-semibold ${net >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {formatCurrency(net)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 border-t border-border">
                  <td className="px-4 py-2 text-xs text-muted-foreground font-medium">Toplam</td>
                  <td className="px-4 py-2 text-right font-mono text-xs font-semibold text-blue-500">{formatCurrency(totalIn)}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs font-semibold text-orange-500">{formatCurrency(totalOut)}</td>
                  <td className={`px-4 py-2 text-right font-mono text-xs font-semibold ${totalNet >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {formatCurrency(totalNet)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      })}

      {!isLoading && grouped.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <BarChart2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Bu dönem için işlem bulunamadı</p>
        </div>
      )}
    </div>
  )
}
