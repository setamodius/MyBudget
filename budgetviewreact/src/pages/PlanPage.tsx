import { useState, useMemo, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getAllBoxes, getBoxes } from "@/api/boxes"
import { getTransactions, addTransaction, updateTransaction, deleteTransaction } from "@/api/transactions"
import { getInstallmentPlans, getInstallmentPlanDetail, createInstallmentPlan, deleteInstallmentPlan } from "@/api/installments"
import { getAllBoxReport } from "@/api/reports"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { formatCurrency, today } from "@/lib/utils"
import { CalendarDays, Target, CreditCard, Plus, Trash2, ChevronDown, TrendingUp, LayoutGrid, Printer } from "lucide-react"
import { usePrint } from "@/lib/print"
import type { Box } from "@/types"

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]

const EMPTY_TX: import("@/types").Transaction[] = []

// ---------------------------------------------------------------------------
// Gelir Planı
// ---------------------------------------------------------------------------
interface PlanRow {
  month: number
  amount: string
  existingId: number | null
  originalAmount: string
}

function GelirPlani({ boxes }: { boxes: Box[] }) {
  const qc = useQueryClient()
  const generators = useMemo(() => boxes.filter(b => b.boxtypeid === 4), [boxes])
  const incomes    = useMemo(() => boxes.filter(b => b.boxtypeid === 1 && b.name !== "Void"), [boxes])

  const [genId, setGenId]           = useState("")
  const [incomeId, setIncomeId]     = useState("")
  const [year, setYear]             = useState(new Date().getFullYear())
  const [defaultAmt, setDefaultAmt] = useState("")
  const [saving, setSaving]         = useState(false)
  const [rows, setRows]             = useState<PlanRow[]>(
    Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: "", existingId: null, originalAmount: "" }))
  )

  useEffect(() => { if (generators.length === 1) setGenId(String(generators[0].id)) }, [generators])
  useEffect(() => { if (incomes.length === 1) setIncomeId(String(incomes[0].id)) }, [incomes])

  // Plan işlemleri: Generator → Income box, description = "Gelir Planı"
  const { data: allTx = EMPTY_TX } = useQuery({
    queryKey: ["plan-tx", genId, incomeId, year],
    queryFn: () => getTransactions({
      from: parseInt(genId), to: parseInt(incomeId),
      start: `${year}-01-01`, end: `${year}-12-31`,
    }),
    enabled: !!genId && !!incomeId,
  })

  // Gerçekleşen işlemler: Income box → Storage (banka hesabı)
  const { data: realizedTx = EMPTY_TX } = useQuery({
    queryKey: ["realized-tx", incomeId, year],
    queryFn: () => getTransactions({
      from: parseInt(incomeId),
      start: `${year}-01-01`, end: `${year}-12-31`,
    }),
    enabled: !!incomeId,
  })

  const planTx = useMemo(() => allTx.filter(tx => tx.description === "Gelir Planı"), [allTx])

  const realizedByMonth = useMemo(() => {
    const map: Record<number, number> = {}
    for (const tx of realizedTx) {
      const month = new Date(tx.date + "T00:00:00").getMonth() + 1
      map[month] = (map[month] ?? 0) + parseFloat(tx.amount)
    }
    return map
  }, [realizedTx])

  useEffect(() => {
    setRows(Array.from({ length: 12 }, (_, i) => {
      const month = i + 1
      const existing = planTx.find(tx => new Date(tx.date + "T00:00:00").getMonth() + 1 === month)
      return {
        month,
        amount: existing ? existing.amount : "",
        existingId: existing?.id ?? null,
        originalAmount: existing?.amount ?? "",
      }
    }))
  }, [planTx])

  function applyToEmpty() {
    if (!defaultAmt) return
    setRows(prev => prev.map(r => r.existingId ? r : { ...r, amount: defaultAmt }))
  }
  function applyToAll() {
    if (!defaultAmt) return
    setRows(prev => prev.map(r => ({ ...r, amount: defaultAmt })))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const ops: Promise<void>[] = []
      for (const row of rows) {
        const amt = parseFloat(row.amount)
        if (!amt || amt <= 0) continue
        const date = `${year}-${String(row.month).padStart(2, "0")}-01`
        if (row.existingId && row.amount !== row.originalAmount) {
          ops.push(updateTransaction(row.existingId, {
            date, frombox: parseInt(genId), tobox: parseInt(incomeId),
            description: "Gelir Planı", amount: amt, info: {},
          }))
        } else if (!row.existingId) {
          ops.push(addTransaction({
            date, frombox: parseInt(genId), tobox: parseInt(incomeId),
            description: "Gelir Planı", amount: amt, info: {},
          }))
        }
      }
      await Promise.all(ops)
      qc.invalidateQueries({ queryKey: ["plan-tx"] })
      qc.invalidateQueries({ queryKey: ["transactions"] })
      qc.invalidateQueries({ queryKey: ["summaries"] })
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletePlan(id: number) {
    await deleteTransaction(id)
    qc.invalidateQueries({ queryKey: ["plan-tx"] })
    qc.invalidateQueries({ queryKey: ["transactions"] })
    qc.invalidateQueries({ queryKey: ["summaries"] })
  }

  const newCount    = rows.filter(r => !r.existingId && parseFloat(r.amount) > 0).length
  const updateCount = rows.filter(r => r.existingId && r.amount !== r.originalAmount && parseFloat(r.amount) > 0).length
  const saveCount   = newCount + updateCount

  return (
    <div className="space-y-4">
      {/* Selectors */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Gelir Hesabı</Label>
          <Select options={incomes.map(b => ({ value: String(b.id), label: b.name }))}
            value={incomeId} onChange={setIncomeId} className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Yıl</Label>
          <div className="flex mt-1">
            <Button variant="outline" size="sm" className="h-8 px-2 rounded-r-none border-r-0 text-xs" onClick={() => setYear(y => y - 1)}>‹</Button>
            <div className="flex-1 flex items-center justify-center border border-border text-sm font-mono">{year}</div>
            <Button variant="outline" size="sm" className="h-8 px-2 rounded-l-none border-l-0 text-xs" onClick={() => setYear(y => y + 1)}>›</Button>
          </div>
        </div>
      </div>

      {/* Bulk assign */}
      <div className="flex gap-2">
        <Input type="number" step="0.01" placeholder="Varsayılan tutar..."
          value={defaultAmt} onChange={e => setDefaultAmt(e.target.value)}
          className="flex-1 h-8 text-sm" />
        <Button variant="outline" size="sm" onClick={applyToEmpty} className="h-8 text-xs whitespace-nowrap">Boşlara</Button>
        <Button variant="outline" size="sm" onClick={applyToAll} className="h-8 text-xs whitespace-nowrap">Tümüne</Button>
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {rows.map((row, i) => {
          const realized = realizedByMonth[i + 1] ?? 0
          const planned  = parseFloat(row.amount) || 0
          const diff     = realized - planned
          const hasRealized = realized > 0
          const changed  = row.existingId && row.amount !== row.originalAmount

          const borderClass = hasRealized && planned > 0
            ? diff >= 0 ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5"
            : row.existingId
            ? "border-primary/30 bg-primary/5"
            : "border-border"

          return (
            <div key={i} className={`rounded-lg border p-2 ${borderClass}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium">{MONTHS[i]}</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px]">
                    {hasRealized && planned > 0
                      ? <span className={diff >= 0 ? "text-emerald-500 font-semibold" : "text-amber-500 font-semibold"}>
                          {diff >= 0 ? "+" : ""}{formatCurrency(diff)}
                        </span>
                      : changed
                      ? <span className="text-orange-500">↻</span>
                      : row.existingId
                      ? <span className="text-primary/60">Plan</span>
                      : parseFloat(row.amount) > 0
                      ? <span className="text-blue-500">+</span>
                      : null}
                  </span>
                  {row.existingId && (
                    <button
                      onClick={() => handleDeletePlan(row.existingId!)}
                      className="text-muted-foreground/40 hover:text-red-500 transition-colors"
                      title="Planı sil"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              <Input
                type="number" step="0.01"
                value={row.amount}
                onChange={e => setRows(prev => prev.map((r, j) => j === i ? { ...r, amount: e.target.value } : r))}
                className="h-7 text-sm font-mono"
                placeholder="Plan —"
              />

              {hasRealized && (
                <div className="mt-1.5 flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Gerçekleşen</span>
                  <span className="font-mono font-semibold text-emerald-600">{formatCurrency(realized)}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Button
        onClick={handleSave}
        disabled={!genId || !incomeId || saveCount === 0 || saving}
        className="w-full"
      >
        {saving ? "Kaydediliyor..." : saveCount > 0
          ? `Kaydet (${[newCount > 0 ? `${newCount} yeni` : "", updateCount > 0 ? `${updateCount} güncelle` : ""].filter(Boolean).join(", ")})`
          : "Değişiklik yok"}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Gider Bütçesi
// ---------------------------------------------------------------------------
function GiderButcesi() {
  const { data: expenseBoxes = [] } = useQuery({ queryKey: ["boxes", "expensetypes"], queryFn: () => getBoxes("expensetypes") })
  const { data: ccBoxes = [] } = useQuery({ queryKey: ["boxes", "creditcards"], queryFn: () => getBoxes("creditcards") })

  const { periodStart, periodEnd, periodLabel } = useMemo(() => {
    const now = new Date()
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    const todayStr = fmt(now)

    const ccWithSettlement = ccBoxes.filter(b => b.settlement && b.settlement > 0)
    if (ccWithSettlement.length === 0) {
      return {
        periodStart: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
        periodEnd: todayStr,
        periodLabel: now.toLocaleDateString("tr-TR", { month: "long", year: "numeric" }) + " bütçesi",
      }
    }

    const settlementDay = Math.min(...ccWithSettlement.map(b => b.settlement!))
    let cycleStart: Date, cycleEnd: Date
    if (now.getDate() <= settlementDay) {
      cycleStart = new Date(now.getFullYear(), now.getMonth() - 1, settlementDay + 1)
      cycleEnd   = new Date(now.getFullYear(), now.getMonth(),     settlementDay)
    } else {
      cycleStart = new Date(now.getFullYear(), now.getMonth(),     settlementDay + 1)
      cycleEnd   = new Date(now.getFullYear(), now.getMonth() + 1, settlementDay)
    }

    const startLabel = cycleStart.toLocaleDateString("tr-TR", { day: "numeric", month: "long" })
    const endLabel   = cycleEnd.toLocaleDateString("tr-TR",   { day: "numeric", month: "long", year: "numeric" })

    return {
      periodStart: fmt(cycleStart),
      periodEnd: todayStr,
      periodLabel: `${startLabel} – ${endLabel} (kesim: ${settlementDay})`,
    }
  }, [ccBoxes])

  const { data: monthlyTx = [] } = useQuery({
    queryKey: ["transactions", "budget-month", periodStart, periodEnd],
    queryFn: () => getTransactions({ start: periodStart, end: periodEnd }),
  })

  const spentByCategory = useMemo(() => {
    const map: Record<number, number> = {}
    for (const tx of monthlyTx) {
      const target = expenseBoxes.find(b => b.id === tx.tobox)
      if (target) map[target.id] = (map[target.id] ?? 0) + parseFloat(tx.amount)
    }
    return map
  }, [monthlyTx, expenseBoxes])

  if (expenseBoxes.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        Tanımlar sayfasından gider türü ekleyin.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground px-1">{periodLabel}</p>
      {expenseBoxes.map(box => {
        const spent  = spentByCategory[box.id] ?? 0
        const budget = box.pluslimit ? parseFloat(String(box.pluslimit)) : null
        const pct    = budget ? Math.min((spent / budget) * 100, 100) : null
        const over   = budget ? spent > budget : false

        return (
          <div key={box.id} className="rounded-xl border border-border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{box.name}</span>
              <span className={`text-sm font-semibold font-mono ${over ? "text-red-500" : "text-foreground"}`}>
                {formatCurrency(spent)}
                {budget && (
                  <span className="text-xs text-muted-foreground font-normal ml-1">/ {formatCurrency(budget)}</span>
                )}
              </span>
            </div>
            {budget ? (
              <>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${over ? "bg-red-500" : pct! > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {over
                    ? `Bütçe ${formatCurrency(spent - budget)} aşıldı`
                    : `${formatCurrency(budget - spent)} kaldı (%${Math.round(100 - pct!)})`}
                </p>
              </>
            ) : (
              <p className="text-[10px] text-muted-foreground">Limit tanımlanmamış — Ayarlar'dan belirleyin</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Taksit Planları
// ---------------------------------------------------------------------------
function TaksitPlanlari({ boxes }: { boxes: Box[] }) {
  const qc = useQueryClient()
  const expenseBoxes  = useMemo(() => boxes.filter(b => b.boxtypeid === 3 && b.name !== "Void"), [boxes])
  const paymentBoxes  = useMemo(() => boxes.filter(b => b.boxtypeid === 2 || b.boxtypeid === 6), [boxes])

  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; description: string } | null>(null)
  const [form, setForm] = useState({
    description: "", expense_box_id: "", payment_box_id: "", start_date: "", total_installments: "", total_amount: "",
  })

  const { data: plans = [] } = useQuery({
    queryKey: ["installment-plans"],
    queryFn: getInstallmentPlans,
  })

  const { data: detail = [] } = useQuery({
    queryKey: ["installment-plan-detail", expandedId],
    queryFn: () => getInstallmentPlanDetail(expandedId!),
    enabled: expandedId !== null,
  })

  const createMutation = useMutation({
    mutationFn: createInstallmentPlan,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["installment-plans"] })
      qc.invalidateQueries({ queryKey: ["transactions"] })
      setShowForm(false)
      setForm({ description: "", expense_box_id: "", payment_box_id: "", start_date: "", total_installments: "", total_amount: "" })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteInstallmentPlan,
    onSuccess: (_, deletedId) => {
      qc.invalidateQueries({ queryKey: ["installment-plans"] })
      qc.invalidateQueries({ queryKey: ["transactions"] })
      if (expandedId === deletedId) setExpandedId(null)
    },
  })

  const formValid = form.description && form.expense_box_id && form.payment_box_id && form.start_date && parseInt(form.total_installments) > 0 && parseFloat(form.total_amount) > 0
  const previewMonthly = form.total_installments && form.total_amount && parseInt(form.total_installments) > 0
    ? Math.round(parseFloat(form.total_amount) / parseInt(form.total_installments) * 100) / 100
    : null
  const todayStr = today()

  const selectedPaymentBox = useMemo(
    () => paymentBoxes.find(b => String(b.id) === form.payment_box_id) ?? null,
    [form.payment_box_id, paymentBoxes]
  )

  const billingInfo = useMemo(() => {
    if (!selectedPaymentBox || selectedPaymentBox.boxtypeid !== 2 || !selectedPaymentBox.settlement || !form.start_date) return null
    const d = new Date(form.start_date + "T00:00:00")
    const inSameMonth = d.getDate() <= selectedPaymentBox.settlement
    const billingMonth = inSameMonth
      ? new Date(d.getFullYear(), d.getMonth(), 1)
      : new Date(d.getFullYear(), d.getMonth() + 1, 1)
    return {
      settlement: selectedPaymentBox.settlement,
      payment: selectedPaymentBox.payment,
      billingMonthLabel: billingMonth.toLocaleDateString("tr-TR", { month: "long", year: "numeric" }),
      inSameMonth,
    }
  }, [selectedPaymentBox, form.start_date])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Yeni Plan
        </Button>
      </div>

      {plans.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Henüz taksit planı yok.
        </div>
      )}

      {plans.map(plan => {
        const elapsed = parseInt(plan.elapsed_count)
        const total = plan.total_installments
        const remaining = total - elapsed
        const pct = total > 0 ? Math.min((elapsed / total) * 100, 100) : 0
        const isExpanded = expandedId === plan.id
        const done = remaining === 0

        return (
          <div key={plan.id} className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{plan.description}</p>
                <p className="text-xs text-muted-foreground">
                  {plan.expense_name}
                  {plan.payment_box_name && <span className="ml-1">· {plan.payment_box_name}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : plan.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent transition-colors"
                  title="Ay detayı"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </button>
                <button
                  onClick={() => setDeleteTarget({ id: plan.id, description: plan.description })}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                  title="Planı sil"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{elapsed}/{total} taksit geçti</span>
              <span className="font-mono font-medium">{formatCurrency(plan.amount_per_month)}<span className="text-muted-foreground font-normal">/ay</span></span>
            </div>

            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${done ? "bg-emerald-500" : "bg-primary"}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{done ? "Tamamlandı" : `${remaining} taksit kaldı`}</span>
              <span>Toplam: {formatCurrency(plan.total_amount)}</span>
            </div>

            {isExpanded && (
              <div className="pt-2 border-t border-border space-y-1">
                {detail.map(row => {
                  const isPast = row.date <= todayStr
                  return (
                    <div key={row.id} className={`flex items-center justify-between text-xs px-2 py-1.5 rounded-lg ${isPast ? "bg-muted/40" : ""}`}>
                      <span className={isPast ? "text-muted-foreground" : "text-foreground"}>
                        {new Date(row.date + "T00:00:00").toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{formatCurrency(row.amount)}</span>
                        <span className="text-muted-foreground/60">{row.installment_no}/{row.total}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Taksit Planı</DialogTitle>
            <DialogClose onClose={() => setShowForm(false)} />
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Açıklama</Label>
              <Input className="mt-1" placeholder="MacBook taksiti" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Gider Kategorisi</Label>
              <Select className="mt-1"
                options={expenseBoxes.map(b => ({ value: String(b.id), label: b.name }))}
                placeholder="Kategori seç..."
                value={form.expense_box_id}
                onChange={v => setForm(f => ({ ...f, expense_box_id: v }))}
              />
            </div>
            <div>
              <Label className="text-xs">Ödeme Kaynağı (KK / Banka)</Label>
              <Select className="mt-1"
                options={paymentBoxes.map(b => ({ value: String(b.id), label: b.boxtypeid === 2 ? `KK: ${b.name}` : `Banka: ${b.name}` }))}
                placeholder="Kaynak seç..."
                value={form.payment_box_id}
                onChange={v => setForm(f => ({ ...f, payment_box_id: v }))}
              />
              {selectedPaymentBox?.boxtypeid === 2 && selectedPaymentBox.settlement && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Kesim: <span className="font-medium text-foreground">{selectedPaymentBox.settlement}</span>
                  {selectedPaymentBox.payment ? (
                    <> · Ödeme: <span className="font-medium text-foreground">{selectedPaymentBox.payment}</span></>
                  ) : null}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">İlk Taksit Tarihi</Label>
                <Input className="mt-1" type="date" value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                {billingInfo && (
                  <p className={`text-[11px] mt-1 ${billingInfo.inSameMonth ? "text-emerald-600" : "text-amber-600"}`}>
                    {billingInfo.inSameMonth
                      ? `${billingInfo.billingMonthLabel} kesimine girer`
                      : `Kesim geçti — ${billingInfo.billingMonthLabel} kesimine girer`}
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs">Taksit Sayısı</Label>
                <Input className="mt-1" type="number" min="1" placeholder="12" value={form.total_installments}
                  onChange={e => setForm(f => ({ ...f, total_installments: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Toplam Tutar</Label>
              <Input className="mt-1 font-mono" type="number" step="0.01" placeholder="0.00" value={form.total_amount}
                onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} />
              {previewMonthly !== null && (
                <p className="text-xs text-muted-foreground mt-1">
                  Aylık: <span className="font-mono font-medium text-foreground">{formatCurrency(previewMonthly)}</span>
                  <span className="ml-1">(son taksit fark varsa düzeltilir)</span>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>İptal</Button>
            <Button onClick={() => createMutation.mutate({
              description: form.description,
              expense_box_id: parseInt(form.expense_box_id),
              payment_box_id: form.payment_box_id ? parseInt(form.payment_box_id) : null,
              start_date: form.start_date,
              total_installments: parseInt(form.total_installments),
              total_amount: parseFloat(form.total_amount),
            })} disabled={!formValid || createMutation.isPending}>
              {createMutation.isPending ? "Oluşturuluyor..." : "Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Planı Sil"
        description={deleteTarget ? `"${deleteTarget.description}" planı silinecek. Bu işlem geri alınamaz.` : ""}
        confirmLabel="Sil"
        destructive
        onConfirm={() => { if (deleteTarget) { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null) } }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Gider Planı (Matris)
// ---------------------------------------------------------------------------
const MONTHS_SHORT = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"]

function GiderPlani({ boxes }: { boxes: Box[] }) {
  const qc = useQueryClient()
  const [year, setYear] = useState(new Date().getFullYear())
  const [editingCell, setEditingCell] = useState<{ boxId: number; month: number } | null>(null)
  const [editValue, setEditValue] = useState("")
  const [saving, setSaving] = useState(false)

  const expenseBoxes  = useMemo(() => boxes.filter(b => b.boxtypeid === 3 && b.name !== "Void"), [boxes])
  const destroyerId   = useMemo(() => boxes.find(b => b.boxtypeid === 5)?.id ?? null, [boxes])
  const expenseIdSet  = useMemo(() => new Set(expenseBoxes.map(b => b.id)), [expenseBoxes])
  const destroyerIdSet = useMemo(() => new Set(boxes.filter(b => b.boxtypeid === 5).map(b => b.id)), [boxes])

  const { data: yearTx = [] } = useQuery({
    queryKey: ["transactions", "gider-plani", year],
    queryFn: () => getTransactions({ start: `${year}-01-01`, end: `${year}-12-31` }),
  })

  const budgetMap = useMemo(() => {
    const map: Record<string, { id: number; amount: number }> = {}
    for (const tx of yearTx) {
      if (!expenseIdSet.has(tx.frombox) || !destroyerIdSet.has(tx.tobox)) continue
      if (tx.info?.type !== "budget") continue
      const month = new Date(tx.date + "T00:00:00").getMonth()
      map[`${tx.frombox}-${month}`] = { id: tx.id, amount: parseFloat(tx.amount) }
    }
    return map
  }, [yearTx, expenseIdSet, destroyerIdSet])

  const installmentMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const tx of yearTx) {
      if (!expenseIdSet.has(tx.frombox) || !destroyerIdSet.has(tx.tobox)) continue
      if (!tx.info?.plan_id) continue
      const month = new Date(tx.date + "T00:00:00").getMonth()
      const key = `${tx.frombox}-${month}`
      map[key] = (map[key] ?? 0) + parseFloat(tx.amount)
    }
    return map
  }, [yearTx, expenseIdSet, destroyerIdSet])

  // Gerçekleşen harcama: Storage/KK → Expense (tobox = expense box), iade düşümü dahil
  const actualMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const tx of yearTx) {
      if (expenseIdSet.has(tx.tobox)) {
        const month = new Date(tx.date + "T00:00:00").getMonth()
        const key = `${tx.tobox}-${month}`
        map[key] = (map[key] ?? 0) + parseFloat(tx.amount)
      } else if (expenseIdSet.has(tx.frombox) && !destroyerIdSet.has(tx.tobox)) {
        const month = new Date(tx.date + "T00:00:00").getMonth()
        const key = `${tx.frombox}-${month}`
        map[key] = (map[key] ?? 0) - parseFloat(tx.amount)
      }
    }
    return map
  }, [yearTx, expenseIdSet, destroyerIdSet])

  async function handleSave(boxId: number, month: number) {
    if (!destroyerId) return
    const amt = parseFloat(editValue)
    if (isNaN(amt) || amt <= 0) { setEditingCell(null); return }
    setSaving(true)
    try {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-01`
      const existing = budgetMap[`${boxId}-${month}`]
      const payload = { date: dateStr, frombox: boxId, tobox: destroyerId, description: "Aylık Bütçe", amount: amt, info: { type: "budget" } }
      if (existing) await updateTransaction(existing.id, payload)
      else await addTransaction(payload)
      qc.invalidateQueries({ queryKey: ["transactions", "gider-plani", year] })
      qc.invalidateQueries({ queryKey: ["transactions", "projection"] })
    } finally {
      setSaving(false)
      setEditingCell(null)
    }
  }

  async function handleDelete(boxId: number, month: number) {
    const existing = budgetMap[`${boxId}-${month}`]
    if (!existing) return
    await deleteTransaction(existing.id)
    qc.invalidateQueries({ queryKey: ["transactions", "gider-plani", year] })
    qc.invalidateQueries({ queryKey: ["transactions", "projection"] })
  }

  const currentYear  = new Date().getFullYear()
  const currentMonth = currentYear === year ? new Date().getMonth() : -1

  if (expenseBoxes.length === 0) {
    return <div className="text-center py-12 text-sm text-muted-foreground">Tanımlar sayfasından gider türü ekleyin.</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Kategori başına aylık harcama tavanı — taksitler dahil</p>
        <div className="flex items-center">
          <Button variant="outline" size="sm" className="h-7 px-2 rounded-r-none border-r-0 text-xs" onClick={() => setYear(y => y - 1)}>‹</Button>
          <div className="flex items-center justify-center h-7 px-3 border border-border text-sm font-mono">{year}</div>
          <Button variant="outline" size="sm" className="h-7 px-2 rounded-l-none border-l-0 text-xs" onClick={() => setYear(y => y + 1)}>›</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground sticky left-0 bg-muted/40 min-w-[110px] z-10">Kategori</th>
                {MONTHS_SHORT.map((m, i) => (
                  <th key={i} className={`px-1 py-2 text-center text-xs font-medium min-w-[72px] ${i === currentMonth ? "text-primary" : "text-muted-foreground"}`}>{m}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {expenseBoxes.map(box => (
                <tr key={box.id} className="hover:bg-muted/10">
                  <td className="px-3 py-1.5 font-medium sticky left-0 bg-card border-r border-border/50 z-10">
                    <div className="truncate max-w-[100px]">{box.name}</div>
                    {box.pluslimit && (
                      <div className="text-[9px] text-muted-foreground/50 font-normal">
                        {formatCurrency(parseFloat(String(box.pluslimit)))}
                      </div>
                    )}
                  </td>
                  {MONTHS_SHORT.map((_, monthIdx) => {
                    const cellKey   = `${box.id}-${monthIdx}`
                    const budget    = budgetMap[cellKey]
                    const installment = installmentMap[cellKey] ?? 0
                    const actual    = actualMap[cellKey] ?? 0
                    const isEditing = editingCell?.boxId === box.id && editingCell?.month === monthIdx
                    const isCurrent = monthIdx === currentMonth
                    const isPast    = year < currentYear || (year === currentYear && monthIdx < currentMonth)
                    const showActual = (isPast || isCurrent) && actual > 0
                    const ceiling   = budget?.amount ?? (box.pluslimit ? parseFloat(String(box.pluslimit)) : null)
                    const overBudget = ceiling !== null && actual > ceiling

                    return (
                      <td key={monthIdx} className={`px-1 py-1 text-center relative group ${isCurrent ? "bg-primary/3" : ""}`}>
                        {isEditing ? (
                          <input
                            autoFocus
                            type="number"
                            step="1"
                            value={editValue}
                            disabled={saving}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => handleSave(box.id, monthIdx)}
                            onKeyDown={e => {
                              if (e.key === "Enter") handleSave(box.id, monthIdx)
                              if (e.key === "Escape") setEditingCell(null)
                            }}
                            className="w-full text-center text-xs font-mono border border-primary rounded px-1 py-0.5 bg-background focus:outline-none"
                          />
                        ) : (
                          <div
                            className="cursor-pointer min-h-[32px] flex flex-col items-center justify-center gap-0.5 rounded hover:bg-muted/30 transition-colors"
                            onClick={() => { setEditingCell({ boxId: box.id, month: monthIdx }); setEditValue(budget ? String(budget.amount) : "") }}
                          >
                            {budget ? (
                              <>
                                <span className="font-mono font-medium text-purple-500 text-xs">{formatCurrency(budget.amount)}</span>
                                {installment > 0 && (
                                  <span className="text-[9px] text-amber-500/80 font-mono">−{formatCurrency(installment)}</span>
                                )}
                              </>
                            ) : box.pluslimit ? (
                              <span className="font-mono text-muted-foreground/25 text-[10px]">{formatCurrency(parseFloat(String(box.pluslimit)))}</span>
                            ) : (
                              <span className="text-muted-foreground/15 text-xs">—</span>
                            )}
                          </div>
                        )}
                        {showActual && !isEditing && (
                          <div className={`text-[9px] font-mono mt-0.5 ${overBudget ? "text-red-500" : "text-emerald-600/70"}`}>
                            {formatCurrency(actual)}
                          </div>
                        )}
                        {budget && !isEditing && (
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(box.id, monthIdx) }}
                            className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-red-500 transition-all"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr className="bg-muted/30 border-t-2 border-border">
                <td className="px-3 py-2 text-xs font-semibold sticky left-0 bg-muted/30 border-r border-border/50 z-10">Toplam</td>
                {MONTHS_SHORT.map((_, monthIdx) => {
                  const total = expenseBoxes.reduce((sum, box) => {
                    const b = budgetMap[`${box.id}-${monthIdx}`]
                    if (b) return sum + b.amount
                    if (box.pluslimit) return sum + parseFloat(String(box.pluslimit))
                    return sum
                  }, 0)
                  return (
                    <td key={monthIdx} className={`px-1 py-2 text-center font-mono text-xs font-semibold ${monthIdx === currentMonth ? "bg-primary/5" : ""}`}>
                      {total > 0 ? formatCurrency(total) : <span className="text-muted-foreground/20">—</span>}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground px-1">
        * Soluk değerler tanımlardaki limittir. Mor değerler girilen aylık bütçe, altındaki tutar taksit yükü.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Projeksiyon
// ---------------------------------------------------------------------------
function getCCPaymentMonth(txDateStr: string, settlementDay: number): string {
  const d = new Date(txDateStr + "T00:00:00")
  const offset = d.getDate() <= settlementDay ? 1 : 2
  const pay = new Date(d.getFullYear(), d.getMonth() + offset, 1)
  return `${pay.getFullYear()}-${String(pay.getMonth() + 1).padStart(2, "0")}`
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function monthBounds(d: Date) {
  const y = d.getFullYear()
  const m = d.getMonth()
  const lastDay = new Date(y, m + 1, 0).getDate()
  const mm = String(m + 1).padStart(2, "0")
  return {
    start: `${y}-${mm}-01`,
    end: `${y}-${mm}-${String(lastDay).padStart(2, "0")}`,
  }
}

function addMonths(d: Date, count: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + count, 1)
}

interface YakinDonemAy {
  key: string
  label: string
  isCurrent: boolean
}

interface YakinDonemData {
  actualIncome: number
  plannedIncome: number
  actualSpend: number
  directSpend: number
  cardSpend: number
  cardDue: number
  plannedExpense: number
  remainingPlan: number
}

function YakinDonem({ boxes }: { boxes: Box[] }) {
  const months = useMemo<YakinDonemAy[]>(() => {
    const now = new Date()
    return [0, 1].map(offset => {
      const d = addMonths(now, offset)
      return {
        key: monthKey(d),
        label: d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" }),
        isCurrent: offset === 0,
      }
    })
  }, [])

  const queryRange = useMemo(() => {
    const now = new Date()
    const start = monthBounds(addMonths(now, -2)).start
    const end = monthBounds(addMonths(now, 1)).end
    return { start, end }
  }, [])

  const { data: txList = [] } = useQuery({
    queryKey: ["transactions", "near-term", queryRange.start, queryRange.end],
    queryFn: () => getTransactions({ start: queryRange.start, end: queryRange.end }),
  })

  const { data: installmentPlans = [] } = useQuery({
    queryKey: ["installment-plans"],
    queryFn: getInstallmentPlans,
  })

  const boxTypeMap = useMemo(() => new Map(boxes.map(b => [b.id, b.boxtypeid])), [boxes])
  const expenseBoxes = useMemo(() => boxes.filter(b => b.boxtypeid === 3 && b.name !== "Void"), [boxes])
  const expenseIdSet = useMemo(() => new Set(expenseBoxes.map(b => b.id)), [expenseBoxes])
  const destroyerIdSet = useMemo(() => new Set(boxes.filter(b => b.boxtypeid === 5).map(b => b.id)), [boxes])
  const ccSettlementMap = useMemo(
    () => new Map(boxes.filter(b => b.boxtypeid === 2 && b.settlement).map(b => [b.id, b.settlement!])),
    [boxes]
  )
  const planPaymentBoxMap = useMemo(
    () => new Map(installmentPlans.filter(p => p.payment_box_id !== null).map(p => [p.id, p.payment_box_id!])),
    [installmentPlans]
  )

  const byMonth = useMemo(() => {
    const map: Record<string, YakinDonemData> = {}
    for (const month of months) {
      map[month.key] = {
        actualIncome: 0,
        plannedIncome: 0,
        actualSpend: 0,
        directSpend: 0,
        cardSpend: 0,
        cardDue: 0,
        plannedExpense: 0,
        remainingPlan: 0,
      }
    }
    const catData: Record<string, { budgets: number; installments: number }> = {}
    const actualCatData: Record<string, number> = {}

    for (const tx of txList) {
      const txKey = tx.date.slice(0, 7)
      const fromType = boxTypeMap.get(tx.frombox)
      const toType = boxTypeMap.get(tx.tobox)
      const amount = parseFloat(tx.amount)

      if (fromType === 1 && toType === 6 && map[txKey]) map[txKey].actualIncome += amount
      if (fromType === 4 && toType === 1 && map[txKey]) map[txKey].plannedIncome += amount

      if (expenseIdSet.has(tx.tobox) && map[txKey]) {
        map[txKey].actualSpend += amount
        if (fromType === 6) map[txKey].directSpend += amount
        if (fromType === 2) map[txKey].cardSpend += amount
        const catKey = `${txKey}-${tx.tobox}`
        actualCatData[catKey] = (actualCatData[catKey] ?? 0) + amount
      } else if (expenseIdSet.has(tx.frombox) && toType === 6 && map[txKey]) {
        map[txKey].actualSpend -= amount
        map[txKey].directSpend -= amount
        const catKey = `${txKey}-${tx.frombox}`
        actualCatData[catKey] = (actualCatData[catKey] ?? 0) - amount
      }

      if (fromType === 2 && toType !== 2 && toType !== 6) {
        const settlement = ccSettlementMap.get(tx.frombox) ?? 31
        const paymentKey = getCCPaymentMonth(tx.date, settlement)
        if (map[paymentKey]) map[paymentKey].cardDue += amount
      }

      if (expenseIdSet.has(tx.frombox) && destroyerIdSet.has(tx.tobox)) {
        let effectiveKey = txKey
        let isCC = false
        if (tx.info?.plan_id) {
          const payBoxId = planPaymentBoxMap.get(parseInt(tx.info.plan_id))
          if (payBoxId !== undefined) {
            const settlement = ccSettlementMap.get(payBoxId)
            if (settlement !== undefined) {
              effectiveKey = getCCPaymentMonth(tx.date, settlement)
              isCC = true
            }
          }
        } else if (tx.info?.type === "budget" && tx.info?.cc_box_id) {
          const settlement = ccSettlementMap.get(parseInt(tx.info.cc_box_id))
          if (settlement !== undefined) effectiveKey = getCCPaymentMonth(tx.date, settlement)
        }
        if (map[effectiveKey]) {
          const catKey = `${effectiveKey}-${tx.frombox}`
          if (!catData[catKey]) catData[catKey] = { budgets: 0, installments: 0 }
          if (tx.info?.type === "budget") {
            catData[catKey].budgets += amount
          } else if (tx.info?.plan_id) {
            catData[catKey].installments += amount
            
            // Treat installment as actual category spend so it reduces remainingPlan correctly
            actualCatData[catKey] = (actualCatData[catKey] ?? 0) + amount
            
            // Add to cash impact
            if (isCC) {
               map[effectiveKey].cardDue += amount
            } else {
               map[effectiveKey].directSpend += amount
               map[effectiveKey].actualSpend += amount
            }
          }
        }
      }
    }

    for (const month of months) {
      const data = map[month.key]
      let totalPlanned = 0
      let totalRemaining = 0
      
      for (const box of expenseBoxes) {
        const planned = catData[`${month.key}-${box.id}`] ?? { budgets: 0, installments: 0 }
        const pluslimit = box.pluslimit ? parseFloat(String(box.pluslimit)) : 0
        const catPlanned = (planned.budgets > 0 ? planned.budgets : planned.installments + pluslimit)
        
        const catActual = actualCatData[`${month.key}-${box.id}`] ?? 0
        
        totalPlanned += catPlanned
        totalRemaining += Math.max(catPlanned - catActual, 0)
      }
      data.plannedExpense = totalPlanned
      data.remainingPlan = totalRemaining
    }

    return map
  }, [txList, boxTypeMap, months, expenseIdSet, destroyerIdSet, ccSettlementMap, planPaymentBoxMap, expenseBoxes])

  const totals = months.reduce((acc, month) => {
    const data = byMonth[month.key]
    const incomeBase = data.actualIncome > 0 ? data.actualIncome : data.plannedIncome
    const cashImpact = data.directSpend + data.cardDue
    const remainingPlan = data.remainingPlan
    acc.income += incomeBase
    acc.cashImpact += cashImpact
    acc.remainingPlan += remainingPlan
    acc.net += incomeBase - cashImpact - remainingPlan
    return acc
  }, { income: 0, cashImpact: 0, remainingPlan: 0, net: 0 })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Gelir", value: totals.income, color: "text-blue-500" },
          { label: "Nakit Etki", value: -totals.cashImpact, color: "text-amber-500" },
          { label: "Kalan Plan", value: -totals.remainingPlan, color: "text-purple-500" },
          { label: "2 Ay Net", value: totals.net, color: totals.net >= 0 ? "text-emerald-500" : "text-red-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-border p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
            <p className={`text-xs font-bold font-mono ${color}`}>
              {value >= 0 ? "" : "-"}{formatCurrency(Math.abs(value))}
            </p>
          </div>
        ))}
      </div>

      {months.map(month => {
        const data = byMonth[month.key]
        const incomeBase = data.actualIncome > 0 ? data.actualIncome : data.plannedIncome
        const cashImpact = data.directSpend + data.cardDue
        const remainingPlan = data.remainingPlan
        const net = incomeBase - cashImpact - remainingPlan
        const positive = net >= 0

        return (
          <div key={month.key} className={`rounded-xl border p-4 space-y-3 ${positive ? "border-emerald-500/25" : "border-red-500/25"} ${month.isCurrent ? "ring-1 ring-primary/30" : ""}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{month.label}</span>
                {month.isCurrent && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Bu ay</span>}
              </div>
              <span className={`text-sm font-bold font-mono ${positive ? "text-emerald-500" : "text-red-500"}`}>
                {positive ? "+" : ""}{formatCurrency(net)}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gelir ({data.actualIncome > 0 ? "gerceklesen" : "plan"})</span>
                <span className="font-mono text-blue-500">{incomeBase > 0 ? formatCurrency(incomeBase) : "-"}</span>
              </div>
              {data.actualIncome > 0 && data.plannedIncome > 0 && (
                <div className="flex justify-between pl-3">
                  <span className="text-muted-foreground/60">Planlanan gelir</span>
                  <span className="font-mono text-blue-500/60">{formatCurrency(data.plannedIncome)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Harcama tarihiyle gerceklesen</span>
                <span className="font-mono text-foreground">{data.actualSpend > 0 ? formatCurrency(data.actualSpend) : "-"}</span>
              </div>
              <div className="flex justify-between pl-3">
                <span className="text-muted-foreground/60">Nakit harcama</span>
                <span className="font-mono text-muted-foreground/80">{data.directSpend > 0 ? formatCurrency(data.directSpend) : "-"}</span>
              </div>
              <div className="flex justify-between pl-3">
                <span className="text-muted-foreground/60">Kartla yapilan</span>
                <span className="font-mono text-muted-foreground/80">{data.cardSpend > 0 ? formatCurrency(data.cardSpend) : "-"}</span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-amber-500/20">
                <span className="text-amber-600/80 flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  Bu ay odenecek/yansiyan KK
                </span>
                <span className="font-mono text-amber-600/80">{data.cardDue > 0 ? `-${formatCurrency(data.cardDue)}` : "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kalan gider plani</span>
                <span className="font-mono text-purple-500">{remainingPlan > 0 ? `-${formatCurrency(remainingPlan)}` : "-"}</span>
              </div>
            </div>
          </div>
        )
      })}

      <p className="text-[10px] text-muted-foreground px-1 pb-1">
        * Kart harcamasi harcandigi ayda gerceklesen olarak gorunur; nakit etkisi kesim gunune gore odeme ayina tasinir.
      </p>
    </div>
  )
}
interface ProjKategori {
  id: number; name: string
  budget: number; installment: number; pluslimit: number | null
  hasBudget: boolean; planned: number
}

function Projeksiyon({ boxes }: { boxes: Box[] }) {
  const [horizon, setHorizon] = useState(6)
  const [openKey,  setOpenKey]  = useState<string | null>(null)
  const { isPrinting, handlePrint } = usePrint()

  const months = useMemo(() => {
    const result = []
    const now = new Date()
    for (let i = 0; i < horizon; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, "0")
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      result.push({
        key: `${y}-${m}`,
        label: d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" }),
        start: `${y}-${m}-01`,
        end: `${y}-${m}-${String(lastDay).padStart(2, "0")}`,
        isCurrent: i === 0,
      })
    }
    return result
  }, [horizon])

  const { data: futureTx = [] } = useQuery({
    queryKey: ["transactions", "projection", months[0]?.start, months[months.length - 1]?.end],
    queryFn: () => getTransactions({ start: months[0].start, end: months[months.length - 1].end }),
    enabled: months.length > 0,
  })

  const { data: installmentPlans = [] } = useQuery({
    queryKey: ["installment-plans"],
    queryFn: getInstallmentPlans,
  })

  const { data: ccReports = [] } = useQuery({
    queryKey: ["report", "creditcards", "all"],
    queryFn: () => getAllBoxReport("creditcards"),
  })
  const prevCCExpense = useMemo(() => {
    const prev = new Date()
    prev.setMonth(prev.getMonth() - 1)
    const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`
    const report = ccReports.find(r => r.month.startsWith(prevKey))
    return report ? parseFloat(report.expense ?? "0") : 0
  }, [ccReports])

  const boxTypeMap     = useMemo(() => new Map(boxes.map(b => [b.id, b.boxtypeid])), [boxes])
  const expenseBoxList = useMemo(() => boxes.filter(b => b.boxtypeid === 3 && b.name !== "Void"), [boxes])
  const expenseIdSet   = useMemo(() => new Set(expenseBoxList.map(b => b.id)), [expenseBoxList])
  const destroyerIdSet = useMemo(() => new Set(boxes.filter(b => b.boxtypeid === 5).map(b => b.id)), [boxes])

  const ccSettlementMap = useMemo(
    () => new Map(boxes.filter(b => b.boxtypeid === 2 && b.settlement).map(b => [b.id, b.settlement!])),
    [boxes]
  )
  const planPaymentBoxMap = useMemo(
    () => new Map(installmentPlans.filter(p => p.payment_box_id !== null).map(p => [p.id, p.payment_box_id!])),
    [installmentPlans]
  )

  const byMonth = useMemo(() => {
    const map: Record<string, { income: number; plannedExpense: number; categories: ProjKategori[] }> = {}
    for (const { key } of months) map[key] = { income: 0, plannedExpense: 0, categories: [] }

    const catData: Record<string, { budgets: number; installments: number }> = {}
    for (const tx of futureTx) {
      const key = tx.date.slice(0, 7)
      if (!map[key]) continue
      const ft = boxTypeMap.get(tx.frombox)
      const tt = boxTypeMap.get(tx.tobox)
      if (ft === 4 && tt === 1) { map[key].income += parseFloat(tx.amount); continue }
      if (expenseIdSet.has(tx.frombox) && destroyerIdSet.has(tx.tobox)) {
        let effectiveKey = key
        if (tx.info?.plan_id) {
          const payBoxId = planPaymentBoxMap.get(parseInt(tx.info.plan_id))
          if (payBoxId !== undefined) {
            const settlement = ccSettlementMap.get(payBoxId)
            if (settlement !== undefined) effectiveKey = getCCPaymentMonth(tx.date, settlement)
          }
        } else if (tx.info?.type === "budget" && tx.info?.cc_box_id) {
          const settlement = ccSettlementMap.get(parseInt(tx.info.cc_box_id))
          if (settlement !== undefined) effectiveKey = getCCPaymentMonth(tx.date, settlement)
        }
        if (!map[effectiveKey]) continue
        const ck = `${effectiveKey}-${tx.frombox}`
        if (!catData[ck]) catData[ck] = { budgets: 0, installments: 0 }
        if (tx.info?.type === "budget") catData[ck].budgets += parseFloat(tx.amount)
        else if (tx.info?.plan_id) catData[ck].installments += parseFloat(tx.amount)
      }
    }

    for (const { key } of months) {
      let totalExpense = 0
      const cats: ProjKategori[] = []
      for (const box of expenseBoxList) {
        const ck = `${key}-${box.id}`
        const cd = catData[ck] ?? { budgets: 0, installments: 0 }
        const pluslimit = box.pluslimit ? parseFloat(String(box.pluslimit)) : null
        const hasBudget = cd.budgets > 0
        const planned = hasBudget ? cd.budgets : (cd.installments + (pluslimit ?? 0))
        if (planned > 0 || cd.installments > 0) {
          cats.push({ id: box.id, name: box.name, budget: cd.budgets, installment: cd.installments, pluslimit, hasBudget, planned })
          totalExpense += planned
        }
      }
      map[key].plannedExpense = totalExpense
      map[key].categories = cats
    }
    return map
  }, [futureTx, boxTypeMap, months, expenseBoxList, expenseIdSet, destroyerIdSet, ccSettlementMap, planPaymentBoxMap])

  const totalIncome  = months.reduce((s, m) => s + (byMonth[m.key]?.income ?? 0), 0)
  const totalExpense = months.reduce((s, m) => s + (byMonth[m.key]?.plannedExpense ?? 0), 0)
  const totalNet     = totalIncome - totalExpense

  let cumNet = 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-xs text-muted-foreground">Planlanan gelir ve gider tahmini</p>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {([1, 3, 6, 12] as const).map(h => (
              <Button key={h} variant={horizon === h ? "default" : "outline"} size="sm" className="h-7 text-xs px-2.5" onClick={() => setHorizon(h)}>{h} ay</Button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs px-2.5 gap-1.5" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" />
            PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Toplam Gelir", value: totalIncome,   color: "text-blue-500" },
          { label: "Gider Planı",  value: -totalExpense, color: "text-purple-500" },
          { label: "Net Tahmin",   value: totalNet,      color: totalNet >= 0 ? "text-emerald-500" : "text-red-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-border p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
            <p className={`text-xs font-bold font-mono ${color}`}>
              {value >= 0 ? "" : "-"}{formatCurrency(Math.abs(value))}
            </p>
          </div>
        ))}
      </div>

      {months.map(({ key, label, isCurrent }) => {
        const data = byMonth[key]
        const net = data.income - data.plannedExpense
        cumNet += net
        const positive = net >= 0
        const isOpen = openKey === key || isPrinting

        return (
          <div key={key} className={`rounded-xl border p-4 space-y-2.5 ${positive ? "border-emerald-500/25" : "border-red-500/25"} ${isCurrent ? "ring-1 ring-primary/30" : ""}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{label}</span>
                {isCurrent && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Bu ay</span>}
              </div>
              <span className={`text-sm font-bold font-mono ${positive ? "text-emerald-500" : "text-red-500"}`}>
                {positive ? "+" : ""}{formatCurrency(net)}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Planlanan Gelir</span>
                <span className={`font-mono ${data.income > 0 ? "text-blue-500" : "text-muted-foreground/40"}`}>
                  {data.income > 0 ? formatCurrency(data.income) : "—"}
                </span>
              </div>

              {data.plannedExpense > 0 && (
                <>
                  <button
                    onClick={() => setOpenKey(v => v === key ? null : key)}
                    className="w-full flex justify-between items-center hover:bg-purple-500/5 rounded px-0.5 -mx-0.5 transition-colors group print:pointer-events-none"
                  >
                    <span className="text-muted-foreground flex items-center gap-1">
                      Gider Planı
                      <ChevronDown className={`h-3 w-3 text-muted-foreground/50 transition-transform print:hidden ${isOpen ? "rotate-180" : ""}`} />
                    </span>
                    <span className="font-mono text-purple-500">−{formatCurrency(data.plannedExpense)}</span>
                  </button>
                  {isOpen && (
                    <div className="rounded-lg bg-purple-500/5 border border-purple-500/15 px-3 py-2 space-y-2">
                      {data.categories.map(cat => (
                        <div key={cat.id} className="space-y-0.5">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground flex items-center gap-1">
                              {cat.name}
                              {!cat.hasBudget && <span className="text-[9px] opacity-40">(limit)</span>}
                            </span>
                            <span className={`font-mono ${cat.hasBudget ? "text-purple-400" : "text-muted-foreground/50"}`}>
                              {formatCurrency(cat.planned)}
                            </span>
                          </div>
                          {cat.installment > 0 && (
                            <div className="flex justify-between items-center pl-3">
                              <span className="text-muted-foreground/60 text-[10px]">↳ taksit</span>
                              <span className="font-mono text-amber-500/80 text-[10px]">{formatCurrency(cat.installment)}</span>
                            </div>
                          )}
                          {cat.hasBudget && (
                            <div className="flex justify-between items-center pl-3">
                              <span className="text-muted-foreground/60 text-[10px]">↳ kalan</span>
                              <span className="font-mono text-emerald-500/80 text-[10px]">{formatCurrency(cat.planned - cat.installment)}</span>
                            </div>
                          )}
                        </div>
                      ))}
                      <div className="flex justify-between items-center pt-1 border-t border-purple-500/15">
                        <span className="text-muted-foreground font-medium">Toplam</span>
                        <span className="font-mono text-purple-500 font-semibold">{formatCurrency(data.plannedExpense)}</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-between pt-1.5 border-t border-border/40">
                <span className="text-muted-foreground">Kümülatif net</span>
                <span className={`font-mono font-medium ${cumNet >= 0 ? "text-emerald-500/80" : "text-red-500/80"}`}>
                  {cumNet >= 0 ? "+" : ""}{formatCurrency(cumNet)}
                </span>
              </div>
              {isCurrent && prevCCExpense > 0 && (
                <div className="flex justify-between items-center pt-1.5 border-t border-amber-500/20">
                  <span className="text-amber-600/70 flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    Geçen dönem KK borcu
                    <span className="text-muted-foreground/40 text-[10px]">(bu ay ödenecek, net dışı)</span>
                  </span>
                  <span className="font-mono text-amber-600/70">−{formatCurrency(prevCCExpense)}</span>
                </div>
              )}
            </div>
          </div>
        )
      })}

      <p className="text-[10px] text-muted-foreground px-1 pb-1">
        * Bütçe girilmişse onu kullanır (taksit dahil); yoksa taksit + limit toplamı.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PlanPage
// ---------------------------------------------------------------------------
export function PlanPage() {
  const [tab, setTab] = useState("projeksiyon")
  const { data: boxes = [] } = useQuery({ queryKey: ["boxes", "all"], queryFn: getAllBoxes })

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <h1 className="text-xl font-semibold">Planlama</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Gelir hedefleri, gider bütçesi ve taksit planları</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <Tabs value={tab} onValueChange={setTab} variant="underline">
          <TabsList className="mb-5">
            <TabsTrigger value="projeksiyon">
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
              Projeksiyon
            </TabsTrigger>
            <TabsTrigger value="yakindonem">
              <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
              Yakin Donem
            </TabsTrigger>
            <TabsTrigger value="giderplani">
              <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
              Gider Planı
            </TabsTrigger>
            <TabsTrigger value="gelir">
              <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
              Gelir Planı
            </TabsTrigger>
            <TabsTrigger value="butce">
              <Target className="h-3.5 w-3.5 mr-1.5" />
              Gider Bütçesi
            </TabsTrigger>
            <TabsTrigger value="taksit">
              <CreditCard className="h-3.5 w-3.5 mr-1.5" />
              Taksitler
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projeksiyon">
            <Projeksiyon boxes={boxes} />
          </TabsContent>

          <TabsContent value="yakindonem">
            <YakinDonem boxes={boxes} />
          </TabsContent>

          <TabsContent value="giderplani">
            <GiderPlani boxes={boxes} />
          </TabsContent>

          <TabsContent value="gelir">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-medium">Aylık Gelir Planı</CardTitle>
              </CardHeader>
              <CardContent>
                <GelirPlani boxes={boxes} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="butce">
            <GiderButcesi />
          </TabsContent>

          <TabsContent value="taksit">
            <TaksitPlanlari boxes={boxes} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
