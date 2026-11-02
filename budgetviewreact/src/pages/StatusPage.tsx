import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { getBalances } from "@/api/balances"
import { getSummaries, getAllBoxReport } from "@/api/reports"
import { getTransactions } from "@/api/transactions"
import { getAllBoxes } from "@/api/boxes"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency, today, getFlowLabel } from "@/lib/utils"
import { ChevronRight, Pencil, Trash2, TrendingUp, TrendingDown, Wallet, CreditCard, PiggyBank, ArrowLeftRight } from "lucide-react"
import { EditTransactionDialog, DeleteTransactionDialog } from "@/components/TransactionDialogs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import type { Transaction } from "@/types"

function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded-lg bg-muted animate-pulse ${className ?? ""}`} />
}

function currentYearMonth() {
  return today().slice(0, 7)
}

function monthRange(ym: string): { start: string; end: string } {
  const [y, m] = ym.split("-").map(Number)
  const start = `${ym}-01`
  const end   = new Date(y, m, 0).toISOString().split("T")[0]
  return { start, end }
}

function prevDay(dateStr: string): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - 1)
  return d.toISOString().split("T")[0]
}

export function StatusPage() {
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth)
  const [deleteTarget, setDeleteTarget]   = useState<Transaction | null>(null)
  const [editTarget, setEditTarget]       = useState<Transaction | null>(null)
  const [showAll, setShowAll]             = useState(false)
  const [selectedFlow, setSelectedFlow]   = useState<{ label: string; color: string; total: number; txs: Transaction[]; billingCycleNote?: boolean } | null>(null)

  const { start: monthStart, end: monthEnd } = monthRange(selectedMonth)
  const prevMonthEnd = prevDay(monthStart)
  // İçinde bulunulan ay için bakiye bugün itibarıyla (ileri tarihli taksitler henüz borç değil);
  // geçmiş aylar için ay sonu itibarıyla
  const balanceDate = selectedMonth === currentYearMonth() ? today() : monthEnd

  const { data: balances = [], isLoading: balLoading } = useQuery({ queryKey: ["balances", balanceDate], queryFn: () => getBalances(balanceDate) })
  const { data: prevBalances = [] } = useQuery({ queryKey: ["balances", prevMonthEnd], queryFn: () => getBalances(prevMonthEnd) })
  const { data: summaries = [], isLoading: sumLoading } = useQuery({ queryKey: ["summaries"], queryFn: getSummaries })
  const { data: allBoxes = [] } = useQuery({ queryKey: ["boxes", "all"], queryFn: getAllBoxes })
  const { data: ccReports = [], isLoading: ccRepLoading } = useQuery({
    queryKey: ["report", "creditcards", "all"],
    queryFn: () => getAllBoxReport("creditcards"),
  })
  const { data: recentTx = [], isLoading: txLoading } = useQuery({
    queryKey: ["transactions", "month", selectedMonth],
    queryFn: () => getTransactions({ start: monthStart, end: monthEnd }),
  })

  const storages     = balances.filter(b => b.boxtypeid === 6)
  const creditCards  = balances.filter(b => b.boxtypeid === 2)
  const investments  = balances.filter(b => b.boxtypeid === 7)

  const totalStorage    = storages.reduce((s, b) => s + parseFloat(b.balance), 0)
  const prevTotalStorage = prevBalances.filter(b => b.boxtypeid === 6).reduce((s, b) => s + parseFloat(b.balance), 0)
  const totalCCDebt     = creditCards.reduce((s, b) => s + Math.max(parseFloat(b.balance), 0), 0)
  const totalInvestment = investments.reduce((s, b) => s + parseFloat(b.balance), 0)
  const netWorth        = totalStorage - totalCCDebt

  const thisMonth   = summaries.find(s => s.month.startsWith(selectedMonth))
  // Billing-cycle CC expense — matches "Hesaplar > Kredi Kartları" tab in AnalysisPage
  const thisCCMonth = ccReports.find(r => r.month.startsWith(selectedMonth))

  const boxMap     = useMemo(() => new Map(allBoxes.map(b => [b.id, b.name])), [allBoxes])
  const boxTypeMap = useMemo(() => new Map(allBoxes.map(b => [b.id, b.boxtypeid])), [allBoxes])

  const monthlyFlow = useMemo(() => {
    if (!thisMonth && boxTypeMap.size === 0) return null
    const sum = (pred: (tx: typeof recentTx[0]) => boolean) =>
      recentTx.filter(pred).reduce((s, tx) => s + parseFloat(tx.amount), 0)
    const fromType = (t: number) => (tx: typeof recentTx[0]) => boxTypeMap.get(tx.frombox) === t
    const toType   = (t: number) => (tx: typeof recentTx[0]) => boxTypeMap.get(tx.tobox) === t
    const income    = thisMonth ? parseFloat(thisMonth.t_income)         : sum(tx => fromType(1)(tx) && toType(6)(tx))
    const directExp = thisMonth ? parseFloat(thisMonth.t_direct_expense) : sum(tx => fromType(6)(tx) && toType(3)(tx)) - sum(tx => fromType(3)(tx) && toType(6)(tx))
    const ccPayment = sum(tx => fromType(6)(tx) && toType(2)(tx))
    // Use billing-cycle CC report — matches "Hesaplar > Kredi Kartları" tab in AnalysisPage
    const ccCharge  = thisCCMonth ? parseFloat(thisCCMonth.expense ?? "0")   : sum(tx => fromType(2)(tx) && toType(3)(tx))
    // Inflows to Storage that are not regular income (Income→Storage), refunds (ExpenseType→Storage),
    // or investment withdrawals (Investments→Storage, counted separately below)
    const externalIncome = sum(tx => toType(6)(tx) && !fromType(1)(tx) && !fromType(3)(tx) && !fromType(6)(tx) && !fromType(7)(tx))
    // Storage↔Investment transfers — move money out of/into the bank account, must be reflected in cash balance
    const investmentOut = sum(tx => fromType(6)(tx) && toType(7)(tx))
    const investmentIn  = sum(tx => fromType(7)(tx) && toType(6)(tx))
    return {
      income, externalIncome, ccPayment, ccCharge, directExp, investmentOut, investmentIn,
      cashBalance: income + externalIncome - ccPayment - directExp - investmentOut + investmentIn,
    }
  }, [thisMonth, thisCCMonth, recentTx, boxTypeMap])

  const flowCards = useMemo(() => {
    if (!monthlyFlow || boxTypeMap.size === 0) return []
    const ft = (t: number) => (tx: Transaction) => boxTypeMap.get(tx.frombox) === t
    const tt = (t: number) => (tx: Transaction) => boxTypeMap.get(tx.tobox)   === t
    return [
      { label: "Gelir",       value: monthlyFlow.income,        color: "text-blue-500",   txs: recentTx.filter(tx => ft(1)(tx) && tt(6)(tx)) },
      ...(monthlyFlow.externalIncome > 0 ? [{ label: "Harici Gelir", value: monthlyFlow.externalIncome, color: "text-teal-500", txs: recentTx.filter(tx => tt(6)(tx) && !ft(1)(tx) && !ft(3)(tx) && !ft(6)(tx) && !ft(7)(tx)) }] : []),
      { label: "KK Ödemesi",  value: monthlyFlow.ccPayment,     color: "text-orange-500", txs: recentTx.filter(tx => ft(6)(tx) && tt(2)(tx)) },
      { label: "KK Harcama",  value: monthlyFlow.ccCharge,      color: "text-amber-500",  txs: recentTx.filter(tx => ft(2)(tx) && !tt(2)(tx) && !tt(6)(tx)), billingCycleNote: true },
      { label: "Nakit Gider", value: monthlyFlow.directExp,     color: "text-purple-500", txs: recentTx.filter(tx => (ft(6)(tx) && tt(3)(tx)) || (ft(3)(tx) && tt(6)(tx))) },
      ...((monthlyFlow.investmentOut > 0 || monthlyFlow.investmentIn > 0) ? [{
        label: "Yatırım",
        value: monthlyFlow.investmentIn - monthlyFlow.investmentOut,
        color: "text-violet-500",
        txs: recentTx.filter(tx => (ft(6)(tx) && tt(7)(tx)) || (ft(7)(tx) && tt(6)(tx))),
      }] : []),
    ].filter(c => Math.abs(c.value) >= 0.005) as { label: string; value: number; color: string; txs: Transaction[]; billingCycleNote?: boolean }[]
  }, [monthlyFlow, recentTx, boxTypeMap])

  // Plan satırları (Generator → Gelir, Gider → Destroyer) gerçek para hareketi değil; burada gösterilmez
  const sortedTx = useMemo(
    () => [...recentTx]
      .filter(tx => boxTypeMap.get(tx.frombox) !== 4 && boxTypeMap.get(tx.tobox) !== 5)
      .sort((a, b) => b.id - a.id),
    [recentTx, boxTypeMap]
  )
  const recentTop = useMemo(
    () => showAll ? sortedTx : sortedTx.slice(0, 15),
    [sortedTx, showAll]
  )

  const isLoading = balLoading || sumLoading
  const flowLoading = txLoading || sumLoading || ccRepLoading

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Bugün</h1>
          <input
            type="month"
            value={selectedMonth}
            max={currentYearMonth()}
            onChange={e => { setSelectedMonth(e.target.value); setShowAll(false) }}
            className="text-sm font-medium bg-muted/60 border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date(`${selectedMonth}-15`).toLocaleDateString("tr-TR", { month: "long", year: "numeric" })} dönemi
          {!thisMonth && !sumLoading && <span className="ml-1 text-amber-500">— veri yok</span>}
          {selectedMonth !== currentYearMonth() && <span className="ml-1">— bakiyeler ay sonu itibariyle</span>}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Net Worth Hero */}
        <Card className={`border-l-4 ${netWorth >= 0 ? "border-emerald-500" : "border-red-500"}`}>
          <CardContent className="p-5">
            {isLoading ? (
              <Skeleton className="h-20" />
            ) : (
              <>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Net Değer</p>
                <p className={`text-3xl font-bold tracking-tight ${netWorth >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {formatCurrency(netWorth)}
                </p>
                <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                  <span>Hesaplar <span className="text-foreground font-medium">{formatCurrency(totalStorage)}</span></span>
                  {totalCCDebt > 0 && (
                    <span>KK Borcu <span className="text-red-500 font-medium">-{formatCurrency(totalCCDebt)}</span></span>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Bu Ay */}
        {(flowLoading || (monthlyFlow !== null)) && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {flowLoading ? [...Array(4)].map((_, i) => (
                <Card key={i}><CardContent className="p-3"><Skeleton className="h-10" /></CardContent></Card>
              )) : flowCards.map(({ label, value, color, txs, billingCycleNote }) => (
                <Card
                  key={label}
                  className="cursor-pointer hover:bg-muted/30 active:scale-[0.98] transition-all"
                  onClick={() => setSelectedFlow({ label, color, total: value, txs, billingCycleNote })}
                >
                  <CardContent className="p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                    <p className={`text-sm font-bold mt-1 ${color}`}>{formatCurrency(value)}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {billingCycleNote ? "ekstre dönemi, taksitler dahil" : "takvim ayı"}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
            {!flowLoading && !balLoading && monthlyFlow && (
              <Card className={`border-l-4 ${monthlyFlow.cashBalance >= 0 ? "border-emerald-500" : "border-red-500"}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Hesaplardaki Değişim</p>
                    <p className={`text-lg font-bold font-mono ${monthlyFlow.cashBalance >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {formatCurrency(monthlyFlow.cashBalance)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/50 text-[11px] font-mono text-muted-foreground">
                    <span>Ay Başı {formatCurrency(prevTotalStorage)}</span>
                    <span>{monthlyFlow.cashBalance >= 0 ? "+" : "−"} {formatCurrency(Math.abs(monthlyFlow.cashBalance))}</span>
                    <span>= {balanceDate === monthEnd ? "Ay Sonu" : "Bugün"} <span className="text-foreground font-semibold">{formatCurrency(totalStorage)}</span></span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Hesaplarım */}
        {(isLoading || storages.length > 0) && (
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Hesaplarım</h2>
            </div>
            <Card>
              <CardContent className="p-0 divide-y divide-border/50">
                {isLoading ? [...Array(2)].map((_, i) => (
                  <div key={i} className="px-4 py-3"><Skeleton className="h-4" /></div>
                )) : storages.map(s => {
                  const bal = parseFloat(s.balance)
                  return (
                    <div key={s.id} className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm font-medium">{s.name}</span>
                      <span className={`text-sm font-semibold font-mono ${bal >= 0 ? "text-foreground" : "text-red-500"}`}>
                        {formatCurrency(bal)}
                      </span>
                    </div>
                  )
                })}
                {!isLoading && storages.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                    <span className="text-xs font-medium text-muted-foreground">Toplam</span>
                    <span className="text-sm font-bold font-mono">{formatCurrency(totalStorage)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Kredi Kartlarım */}
        {(isLoading || creditCards.length > 0) && (
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Kredi Kartlarım</h2>
            </div>
            <Card>
              <CardContent className="p-0 divide-y divide-border/50">
                {isLoading ? [...Array(1)].map((_, i) => (
                  <div key={i} className="px-4 py-3"><Skeleton className="h-4" /></div>
                )) : creditCards.filter(cc => Math.abs(parseFloat(cc.balance)) >= 0.005).map(cc => {
                  const debt = parseFloat(cc.balance)
                  return (
                    <div key={cc.id} className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm font-medium">{cc.name}</span>
                      <span className={`text-sm font-semibold font-mono ${debt > 0 ? "text-amber-500" : "text-emerald-500"}`}>
                        {debt > 0 ? `-${formatCurrency(debt)}` : formatCurrency(0)}
                      </span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Yatırımlarım */}
        {!isLoading && investments.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <PiggyBank className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Yatırımlarım</h2>
            </div>
            <Card>
              <CardContent className="p-0 divide-y divide-border/50">
                {investments.map(inv => {
                  const val = parseFloat(inv.balance)
                  return (
                    <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm font-medium">{inv.name}</span>
                      <span className="text-sm font-semibold font-mono text-violet-500">{formatCurrency(val)}</span>
                    </div>
                  )
                })}
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                  <span className="text-xs font-medium text-muted-foreground">Toplam</span>
                  <span className="text-sm font-bold font-mono">{formatCurrency(totalInvestment)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Son İşlemler */}
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Son İşlemler</h2>
          </div>
          <Card>
            <CardContent className="p-0">
              {txLoading ? (
                <div className="divide-y divide-border/50">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="px-4 py-3 flex gap-3">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              ) : recentTop.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <ArrowLeftRight className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Henüz işlem yok</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {recentTop.map(tx => {
                    const fromType = boxTypeMap.get(tx.frombox)
                    const toType   = boxTypeMap.get(tx.tobox)
                    const flow     = getFlowLabel(fromType, toType)
                    return (
                      <div key={tx.id} className="group flex items-center gap-2 px-4 py-3 hover:bg-muted/20 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${flow.cls}`}>
                              {flow.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">{tx.date}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                            <span className="truncate">{boxMap.get(tx.frombox) ?? tx.frombox}</span>
                            <ChevronRight className="h-3 w-3 shrink-0" />
                            <span className="truncate">{boxMap.get(tx.tobox) ?? tx.tobox}</span>
                          </div>
                          {tx.description && (
                            <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{tx.description}</p>
                          )}
                        </div>
                        <span className="text-sm font-semibold font-mono shrink-0">{formatCurrency(tx.amount)}</span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditTarget(tx)}>
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(tx)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          {!txLoading && sortedTx.length > 15 && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-2 transition-colors"
            >
              {showAll ? "Daha az göster" : `Tümünü göster (${sortedTx.length} işlem)`}
            </button>
          )}
        </div>

        {/* Trend */}
        {!flowLoading && monthlyFlow && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-1 pb-2">
            {monthlyFlow.cashBalance >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
            )}
            <span>
              Bu ay {monthlyFlow.cashBalance >= 0 ? "pozitif" : "negatif"} nakit bakiye —{" "}
              {formatCurrency(Math.abs(monthlyFlow.cashBalance))}
            </span>
          </div>
        )}
      </div>

      {/* Flow drill-down dialog */}
      <Dialog open={selectedFlow !== null} onOpenChange={open => { if (!open) setSelectedFlow(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={selectedFlow?.color}>{selectedFlow?.label}</DialogTitle>
            {selectedFlow?.billingCycleNote && (
              <p className="text-[10px] text-muted-foreground">Toplam fatura dönemi bazlıdır; listedeki işlemler takvim ayına göredir.</p>
            )}
          </DialogHeader>
          <DialogClose onClose={() => setSelectedFlow(null)} />
          <div className="divide-y divide-border/50">
            {selectedFlow?.txs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">İşlem bulunamadı</p>
            ) : selectedFlow?.txs.slice().sort((a, b) => b.id - a.id).map(tx => {
              const isRefund = selectedFlow.label === "Nakit Gider" && boxTypeMap.get(tx.frombox) === 3
              const amount = isRefund ? -parseFloat(tx.amount as unknown as string) : parseFloat(tx.amount as unknown as string)
              return (
                <div key={tx.id} className="py-2.5 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                      <span>{boxMap.get(tx.frombox) ?? tx.frombox}</span>
                      <ChevronRight className="h-2.5 w-2.5 shrink-0" />
                      <span>{boxMap.get(tx.tobox) ?? tx.tobox}</span>
                      <span className="ml-1 font-mono">{tx.date}</span>
                    </div>
                    {tx.description && <p className="text-xs text-foreground truncate">{tx.description}</p>}
                  </div>
                  <span className={`text-sm font-semibold font-mono shrink-0 ${isRefund ? "text-emerald-500" : ""}`}>
                    {isRefund ? "-" : ""}{formatCurrency(Math.abs(amount))}
                  </span>
                </div>
              )
            })}
          </div>
          {selectedFlow && selectedFlow.txs.length > 0 && (
            <div className="flex justify-between items-center pt-3 border-t border-border mt-1">
              <span className="text-xs text-muted-foreground font-medium">Toplam</span>
              <span className={`text-sm font-bold font-mono ${selectedFlow.color}`}>{formatCurrency(selectedFlow.total)}</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EditTransactionDialog target={editTarget} onClose={() => setEditTarget(null)} />
      <DeleteTransactionDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  )
}
