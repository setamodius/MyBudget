import { useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getAllBoxes } from "@/api/boxes"
import { getTransactions } from "@/api/transactions"
import { getBoxReport } from "@/api/reports"
import { formatCurrency, formatMonth } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { ArrowLeft } from "lucide-react"
import type { BoxType, Transaction } from "@/types"

const BOXTYPEID_TO_APITYPE: Record<number, BoxType> = {
  1: "incomes",
  2: "creditcards",
  3: "expensetypes",
  6: "storages",
  7: "investments",
}

const BOXTYPEID_LABEL: Record<number, string> = {
  1: "Gelir",
  2: "Kredi Kartı",
  3: "Gider Kategorisi",
  6: "Banka / Nakit",
  7: "Yatırım",
}

// Transaction classification
// - plan:    Generator→box or box→Destroyer (budget entry, not real money)
// - income:  Income→Storage (actual income delivered to bank)
// - expense: Storage/CC→ExpenseType (actual spending)
// - refund:  ExpenseType→Storage (money back)
// - default: everything else (CC payments, transfers, etc.)
type TxKind = "plan" | "income" | "expense" | "refund" | "default"

const GENERATOR_TYPE  = 4
const DESTROYER_TYPE  = 5
const STORAGE_TYPE    = 6
const CC_TYPE         = 2

function classifyTx(
  tx: Transaction,
  sign: number,
  currentBoxTypeId: number,
  boxTypeMap: Map<number, number>,
): TxKind {
  const fromTypeId = boxTypeMap.get(tx.frombox) ?? 0
  const toTypeId   = boxTypeMap.get(tx.tobox)   ?? 0

  if (fromTypeId === GENERATOR_TYPE) return "plan"
  if (toTypeId   === DESTROYER_TYPE) return "plan"

  // Income box: txOut (Income→Storage) = actual income received
  if (currentBoxTypeId === 1 && sign === -1) return "income"

  // ExpenseType box: txIn from Storage or CC = actual spending
  if (currentBoxTypeId === 3 && sign === +1) {
    if (fromTypeId === STORAGE_TYPE || fromTypeId === CC_TYPE) return "expense"
  }

  // ExpenseType box: txOut to Storage = refund
  if (currentBoxTypeId === 3 && sign === -1 && toTypeId === STORAGE_TYPE) return "refund"

  return "default"
}

const KIND_BADGE: Record<TxKind, { label: string | null; bg: string; text: string }> = {
  plan:    { label: "Plan",    bg: "bg-muted",                      text: "text-muted-foreground" },
  income:  { label: "Gelir",   bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400" },
  expense: { label: "Harcama", bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400" },
  refund:  { label: "İade",    bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400" },
  default: { label: null,      bg: "", text: "" },
}

function amtDisplay(amt: number, kind: TxKind): { value: number; color: string } {
  if (kind === "plan")    return { value: Math.abs(amt), color: "text-muted-foreground" }
  if (kind === "income")  return { value: Math.abs(amt), color: "text-emerald-500" }
  if (kind === "expense") return { value: -Math.abs(amt), color: "text-red-500" }
  if (kind === "refund")  return { value: Math.abs(amt), color: "text-emerald-500" }
  return { value: amt, color: "" }  // "default" — caller decides
}

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  color: "hsl(var(--foreground))",
  borderRadius: "8px",
  fontSize: "12px",
}

export function BoxDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const boxId = parseInt(id ?? "0")

  const { data: allBoxes = [] } = useQuery({
    queryKey: ["boxes", "all"],
    queryFn: getAllBoxes,
  })
  const box = allBoxes.find(b => b.id === boxId)
  const apiType = box ? BOXTYPEID_TO_APITYPE[box.boxtypeid] : undefined
  const isCreditCard = box?.boxtypeid === 2

  const boxTypeMap = useMemo(
    () => new Map(allBoxes.map(b => [b.id, b.boxtypeid])),
    [allBoxes],
  )

  const { data: reports = [] } = useQuery({
    queryKey: ["report", apiType, boxId],
    queryFn: () => getBoxReport(apiType!, boxId),
    enabled: !!apiType,
  })

  const { data: txIn = [], isLoading: loadIn } = useQuery({
    queryKey: ["tx", "to", boxId],
    queryFn: () => getTransactions({ to: boxId, start: "2000-01-01", end: "2100-12-31" }),
    enabled: boxId > 0,
  })
  const { data: txOut = [], isLoading: loadOut } = useQuery({
    queryKey: ["tx", "from", boxId],
    queryFn: () => getTransactions({ from: boxId, start: "2000-01-01", end: "2100-12-31" }),
    enabled: boxId > 0,
  })

  const txWithBalance = useMemo(() => {
    const currentBoxTypeId = box?.boxtypeid ?? 0
    const isIncomeBox  = currentBoxTypeId === 1
    const isExpenseBox = currentBoxTypeId === 3

    const merged = [
      ...txIn.map(tx  => ({ ...tx, _sign: isCreditCard ? -1 : +1 as (-1 | 1) })),
      ...txOut.map(tx => ({ ...tx, _sign: isCreditCard ? +1 : -1 as (-1 | 1) })),
    ]
    merged.sort((a, b) => {
      const d = a.date.localeCompare(b.date)
      return d !== 0 ? d : a.id - b.id
    })

    let running = 0
    return merged
      .map(tx => {
        const kind = classifyTx(tx, tx._sign, currentBoxTypeId, boxTypeMap)

        if (kind === "plan") {
          // Plans never affect the real balance — running stays unchanged
        } else if (isIncomeBox && kind === "income") {
          // Income→Storage: actual income received → always positive
          running += parseFloat(tx.amount)
        } else if (isExpenseBox && kind === "expense") {
          // Storage/CC→ExpenseType: actual spending → accumulates positively
          running += parseFloat(tx.amount)
        } else if (isExpenseBox && kind === "refund") {
          // ExpenseType→Storage: refund reduces spending
          running -= parseFloat(tx.amount)
        } else {
          // Default: Storage, Investment, CC, and edge-case defaults
          running += tx._sign * parseFloat(tx.amount)
        }

        return { ...tx, running, kind }
      })
      .reverse()
  }, [txIn, txOut, isCreditCard, box, boxTypeMap])

  const currentBalance = txWithBalance.length > 0 ? txWithBalance[0].running : 0
  const isLoading = loadIn || loadOut || !box

  // Chart bars and data differ by box type
  // Income box:      r.income = plan (Generator→Income), r.expense = actual (Income→Storage)
  // ExpenseType box: r.settled = budget (→Destroyer), r.charged = actual spending
  // Others:          r.income/r.expense = standard in/out
  type ChartBar = { key: string; fill: string }
  const chartBars: ChartBar[] =
    box?.boxtypeid === 1 ? [
      { key: "Plan",   fill: "#94a3b8" },
      { key: "Gerçek", fill: "#10b981" },
    ] :
    box?.boxtypeid === 3 ? [
      { key: "Bütçe",  fill: "#3b82f6" },
      { key: "Gerçek", fill: "#f97316" },
    ] : [
      { key: "Giren",  fill: "#3b82f6" },
      { key: "Çıkan",  fill: "#f97316" },
    ]

  // Show current year; fall back to last 12 months if no current-year data
  const currentYear = String(new Date().getFullYear())
  const yearReports = reports.filter(r => r.month.slice(0, 4) === currentYear)
  const displayReports = yearReports.length > 0 ? yearReports : reports.slice(-12)
  const chartLabel = yearReports.length > 0 ? `${currentYear} — Aylık` : "Son 12 Ay"

  const chartData = displayReports.map(r => {
    const name = formatMonth(r.month)
    if (box?.boxtypeid === 1) return {
      name,
      Plan:   parseFloat(r.income  ?? "0"),
      Gerçek: parseFloat(r.expense ?? "0"),
    }
    if (box?.boxtypeid === 3) return {
      name,
      Bütçe:  parseFloat(r.settled ?? "0"),
      Gerçek: parseFloat(r.charged ?? "0"),
    }
    return {
      name,
      Giren: parseFloat(r.income ?? r.charged ?? "0"),
      Çıkan: parseFloat(r.expense ?? r.settled ?? r.planned ?? "0"),
    }
  })

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/hesaplar")}
            className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">{box?.name ?? "—"}</h1>
            <p className="text-xs text-muted-foreground">{box ? (BOXTYPEID_LABEL[box.boxtypeid] ?? "") : ""}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Balance hero */}
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              {isCreditCard          ? "Toplam Borç"    :
               box?.boxtypeid === 1 ? "Toplam Gelir"   :
               box?.boxtypeid === 3 ? "Toplam Harcama" :
               "Güncel Bakiye"}
            </p>
            {isLoading ? (
              <div className="h-9 w-40 rounded bg-muted animate-pulse" />
            ) : (
              <p className={`text-3xl font-bold font-mono tracking-tight ${
                isCreditCard
                  ? currentBalance > 0 ? "text-amber-500" : "text-emerald-500"
                  : box?.boxtypeid === 3
                    ? "text-orange-500"
                    : currentBalance >= 0 ? "text-foreground" : "text-red-500"
              }`}>
                {isCreditCard && currentBalance > 0 ? "-" : ""}
                {formatCurrency(Math.abs(currentBalance))}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Monthly chart */}
        {chartData.length > 0 && (
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                {chartLabel}
              </p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v: number) => `₺${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                  {chartBars.map(b => (
                    <Bar key={b.key} dataKey={b.key} fill={b.fill} radius={[3, 3, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Transaction history */}
        <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
          <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              İşlem Geçmişi
            </span>
            {txWithBalance.length > 0 && (
              <span className="text-xs text-muted-foreground">{txWithBalance.length} işlem</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Tarih</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Açıklama</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground whitespace-nowrap">Tutar</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground whitespace-nowrap">Bakiye</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {isLoading && [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(4)].map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3.5 rounded bg-muted animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}
                {!isLoading && txWithBalance.map((tx, i) => {
                  const rawAmt = tx._sign * parseFloat(tx.amount)
                  const badge = KIND_BADGE[tx.kind]

                  // Amount display: kind-based for Income/ExpenseType boxes, sign-based for rest
                  let displayValue: number
                  let amtColor: string
                  if (tx.kind !== "default") {
                    const d = amtDisplay(rawAmt, tx.kind)
                    displayValue = d.value
                    amtColor = d.color
                  } else if (isCreditCard) {
                    displayValue = rawAmt
                    amtColor = rawAmt < 0 ? "text-emerald-500" : "text-red-500"
                  } else {
                    displayValue = rawAmt
                    amtColor = rawAmt >= 0 ? "text-emerald-500" : "text-red-500"
                  }

                  // Running balance colour
                  const balColor = isCreditCard
                    ? tx.running > 0 ? "text-amber-500" : "text-foreground"
                    : tx.running < 0 ? "text-red-500" : "text-foreground"

                  return (
                    <tr key={`${tx.id}-${i}`} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {tx.date}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {badge.label && (
                            <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-semibold ${badge.bg} ${badge.text}`}>
                              {badge.label}
                            </span>
                          )}
                          <span className="text-sm truncate text-foreground/80 max-w-[140px]">
                            {tx.description || "—"}
                          </span>
                        </div>
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono text-sm ${amtColor}`}>
                        {displayValue > 0 ? "+" : ""}{formatCurrency(displayValue)}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono text-sm font-medium ${balColor}`}>
                        {isCreditCard && tx.running > 0 ? "-" : ""}
                        {formatCurrency(Math.abs(tx.running))}
                      </td>
                    </tr>
                  )
                })}
                {!isLoading && txWithBalance.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      Henüz işlem yok
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
