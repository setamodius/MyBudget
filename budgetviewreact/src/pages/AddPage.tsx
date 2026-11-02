import { useState, useMemo, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getBoxes } from "@/api/boxes"
import { addTransaction, addIncomeTransaction, getTransactions, updateTransaction } from "@/api/transactions"
import { getInstallmentPlans, createInstallmentPlan } from "@/api/installments"
import type { Transaction } from "@/types"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn, formatCurrency } from "@/lib/utils"
import { today } from "@/lib/utils"
import { TrendingUp, ShoppingCart, CreditCard, ArrowLeftRight, Layers, PiggyBank, Gift, Undo2 } from "lucide-react"
import type { Box } from "@/types"

// ---------------------------------------------------------------------------
// Pill selector
// ---------------------------------------------------------------------------
function BoxPills({ boxes, value, onChange }: { boxes: Box[]; value: number; onChange: (id: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {boxes.map(box => (
        <button
          key={box.id}
          type="button"
          onClick={() => onChange(box.id)}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm border transition-all",
            value === box.id
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
          )}
        >
          {box.name}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Amount + Date + Description shared fields
// ---------------------------------------------------------------------------
function CommonFields({
  amount, date, description, onAmountChange, onDateChange, onDescriptionChange
}: {
  amount: string; date: string; description: string
  onAmountChange: (v: string) => void
  onDateChange: (v: string) => void
  onDescriptionChange: (v: string) => void
}) {
  return (
    <>
      <div>
        <Label className="text-xs text-muted-foreground">Tutar *</Label>
        <Input
          type="number" step="0.01" min="0.01"
          value={amount}
          onChange={e => onAmountChange(e.target.value)}
          placeholder="0,00"
          className="mt-1 text-xl font-mono h-12 text-center"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Tarih</Label>
          <Input type="date" value={date} onChange={e => onDateChange(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Açıklama</Label>
          <Input value={description} onChange={e => onDescriptionChange(e.target.value)} placeholder="İsteğe bağlı" className="mt-1" />
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Gelir Form (Income → Storage)
// ---------------------------------------------------------------------------
function IncomeForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data: incomes = [] }  = useQuery({ queryKey: ["boxes", "incomes"],   queryFn: () => getBoxes("incomes") })
  const { data: storages = [] } = useQuery({ queryKey: ["boxes", "storages"],  queryFn: () => getBoxes("storages") })

  const [frombox, setFrombox] = useState(0)
  const [tobox, setTobox]     = useState(0)
  const [amount, setAmount]   = useState("")
  const [date, setDate]       = useState(today())
  const [desc, setDesc]       = useState("")
  const [error, setError]     = useState("")
  const [saving, setSaving]   = useState(false)

  // O aya ait plan transaction'ını çek (Generator → Income box)
  const monthStart = useMemo(() => {
    const d = new Date(date + "T00:00:00")
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
  }, [date])
  const monthEnd = useMemo(() => {
    const d = new Date(date + "T00:00:00")
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`
  }, [date])

  const { data: monthTx = [] } = useQuery({
    queryKey: ["plan-for-income", frombox, monthStart],
    queryFn: () => getTransactions({ to: frombox, start: monthStart, end: monthEnd }),
    enabled: frombox > 0,
  })

  const planTx: Transaction | null = useMemo(
    () => monthTx.find(tx => tx.description === "Gelir Planı") ?? null,
    [monthTx]
  )

  // Plan gelince amount'u otomatik doldur
  useEffect(() => {
    if (planTx && !amount) setAmount(planTx.amount)
  }, [planTx])

  const canSave = frombox > 0 && tobox > 0 && parseFloat(amount) > 0

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["transactions"] })
    qc.invalidateQueries({ queryKey: ["balances"] })
    qc.invalidateQueries({ queryKey: ["summaries"] })
    qc.invalidateQueries({ queryKey: ["flows"] })
    qc.invalidateQueries({ queryKey: ["plan-tx"] })
    qc.invalidateQueries({ queryKey: ["plan-for-income"] })
  }

  async function save(overrideAmount?: number) {
    const amt = overrideAmount ?? parseFloat(amount)
    if (!amt || amt <= 0 || frombox === 0 || tobox === 0) return
    setError("")
    setSaving(true)
    try {
      await addIncomeTransaction({ date, frombox, tobox, description: desc || "Gelir", amount: amt, info: {} })
      // Plan varsa ve tutar farklıysa → planı da güncelle
      if (planTx && parseFloat(planTx.amount) !== amt) {
        await updateTransaction(planTx.id, {
          date: planTx.date,
          frombox: planTx.frombox,
          tobox: planTx.tobox,
          description: "Gelir Planı",
          amount: amt,
          info: {},
        })
      }
      invalidate()
      onClose()
    } catch (e) {
      setError((e as Error).message || "Kayıt hatası")
    } finally {
      setSaving(false)
    }
  }

  const planAmt = planTx ? parseFloat(planTx.amount) : null
  const isExact = planAmt !== null && parseFloat(amount) === planAmt

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs text-muted-foreground">Gelir Hesabı *</Label>
        <div className="mt-2">
          {incomes.length === 0
            ? <p className="text-xs text-muted-foreground">Ayarlar'dan gelir hesabı ekleyin.</p>
            : <BoxPills boxes={incomes} value={frombox} onChange={id => { setFrombox(id); setAmount("") }} />}
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Banka Hesabı *</Label>
        <div className="mt-2">
          {storages.length === 0
            ? <p className="text-xs text-muted-foreground">Ayarlar'dan banka hesabı ekleyin.</p>
            : <BoxPills boxes={storages} value={tobox} onChange={setTobox} />}
        </div>
      </div>

      {planTx && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs flex items-center justify-between">
          <span className="text-muted-foreground">
            {new Date(monthStart + "T00:00:00").toLocaleDateString("tr-TR", { month: "long", year: "numeric" })} planı
          </span>
          <span className="font-mono font-semibold">{formatCurrency(planTx.amount)}</span>
        </div>
      )}

      <CommonFields
        amount={amount} date={date} description={desc}
        onAmountChange={setAmount} onDateChange={setDate} onDescriptionChange={setDesc}
      />

      {error && <p className="text-xs text-red-500">{error}</p>}

      <DialogFooter className="flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={onClose} disabled={saving}>İptal</Button>
        {planTx && isExact ? (
          <Button onClick={() => save(planAmt!)} disabled={saving} className="flex-1">
            {saving ? "Kaydediliyor..." : `Planı onayla — ${formatCurrency(planTx.amount)}`}
          </Button>
        ) : (
          <Button onClick={() => save()} disabled={!canSave || saving} className="flex-1">
            {saving ? "Kaydediliyor..." : planTx && !isExact
              ? "Kaydet & Planı Güncelle"
              : "Kaydet"}
          </Button>
        )}
      </DialogFooter>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Harcama Form (Storage → ExpenseType)
// ---------------------------------------------------------------------------
function HarcamaForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data: storages = [] }     = useQuery({ queryKey: ["boxes", "storages"], queryFn: () => getBoxes("storages") })
  const { data: expenseTypes = [] } = useQuery({ queryKey: ["boxes", "expensetypes"], queryFn: () => getBoxes("expensetypes") })

  const [frombox, setFrombox] = useState(0)
  const [tobox, setTobox]     = useState(0)
  const [amount, setAmount]   = useState("")
  const [date, setDate]       = useState(today())
  const [desc, setDesc]       = useState("")
  const [error, setError]     = useState("")

  const mut = useMutation({
    mutationFn: addTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] })
      qc.invalidateQueries({ queryKey: ["balances"] })
      qc.invalidateQueries({ queryKey: ["summaries"] })
      qc.invalidateQueries({ queryKey: ["flows"] })
      onClose()
    },
    onError: (e: Error) => setError(e.message || "Kayıt hatası"),
  })

  const canSave = frombox > 0 && tobox > 0 && parseFloat(amount) > 0

  function save() {
    if (!canSave) return
    setError("")
    mut.mutate({ date, frombox, tobox, description: desc || "Harcama", amount: parseFloat(amount), info: {} })
  }

  return (
    <div className="space-y-4">
      <CommonFields
        amount={amount} date={date} description={desc}
        onAmountChange={setAmount} onDateChange={setDate} onDescriptionChange={setDesc}
      />
      <div>
        <Label className="text-xs text-muted-foreground">Hangi Hesaptan *</Label>
        <div className="mt-2">
          {storages.length === 0
            ? <p className="text-xs text-muted-foreground">Ayarlar'dan hesap ekleyin.</p>
            : <BoxPills boxes={storages} value={frombox} onChange={setFrombox} />}
        </div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Harcama Kategorisi *</Label>
        <div className="mt-2"><BoxPills boxes={expenseTypes} value={tobox} onChange={setTobox} /></div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>İptal</Button>
        <Button onClick={save} disabled={!canSave || mut.isPending}>
          {mut.isPending ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </DialogFooter>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Kart Harcaması Form (CreditCard → ExpenseType)
// ---------------------------------------------------------------------------
function KartHarcamasiForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data: creditCards = [] }  = useQuery({ queryKey: ["boxes", "creditcards"], queryFn: () => getBoxes("creditcards") })
  const { data: expenseTypes = [] } = useQuery({ queryKey: ["boxes", "expensetypes"], queryFn: () => getBoxes("expensetypes") })

  const [frombox, setFrombox] = useState(0)
  const [tobox, setTobox]     = useState(0)
  const [amount, setAmount]   = useState("")
  const [date, setDate]       = useState(today())
  const [desc, setDesc]       = useState("")
  const [error, setError]     = useState("")
  const [taksit, setTaksit]   = useState("1")

  const installments = Math.max(parseInt(taksit) || 1, 1)

  const mut = useMutation({
    mutationFn: async () => {
      const description = desc || "Kart Harcaması"
      if (installments > 1) {
        // Taksitli: plan + her ay için kart işlemi oluşturulur
        await createInstallmentPlan({
          description,
          merchant: description,
          expense_box_id: tobox,
          payment_box_id: frombox,
          purchase_date: date,
          total_installments: installments,
          total_amount: parseFloat(amount),
          auto_link: true,
          card_txns: true,
        })
      } else {
        await addTransaction({ date, frombox, tobox, description, amount: parseFloat(amount), info: {} })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] })
      qc.invalidateQueries({ queryKey: ["balances"] })
      qc.invalidateQueries({ queryKey: ["summaries"] })
      qc.invalidateQueries({ queryKey: ["flows"] })
      qc.invalidateQueries({ queryKey: ["installment-plans"] })
      onClose()
    },
    onError: (e: Error) => setError(e.message || "Kayıt hatası"),
  })

  const canSave = frombox > 0 && tobox > 0 && parseFloat(amount) > 0

  function save() {
    if (!canSave) return
    setError("")
    mut.mutate()
  }

  return (
    <div className="space-y-4">
      <CommonFields
        amount={amount} date={date} description={desc}
        onAmountChange={setAmount} onDateChange={setDate} onDescriptionChange={setDesc}
      />
      <div>
        <Label className="text-xs text-muted-foreground">Hangi Karttan *</Label>
        <div className="mt-2">
          {creditCards.length === 0
            ? <p className="text-xs text-muted-foreground">Ayarlar'dan kredi kartı ekleyin.</p>
            : <BoxPills boxes={creditCards} value={frombox} onChange={setFrombox} />}
        </div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Harcama Kategorisi *</Label>
        <div className="mt-2"><BoxPills boxes={expenseTypes} value={tobox} onChange={setTobox} /></div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Taksit</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {["1", "2", "3", "4", "6", "9", "12"].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setTaksit(n)}
              className={cn(
                "px-3 py-1 rounded-full text-sm border transition-all",
                taksit === n
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
              )}
            >
              {n === "1" ? "Tek çekim" : n}
            </button>
          ))}
          <Input
            type="number" min="1" value={taksit}
            onChange={e => setTaksit(e.target.value)}
            className="w-20 h-8"
          />
        </div>
        {installments > 1 && parseFloat(amount) > 0 && (
          <p className="text-xs text-muted-foreground mt-1.5">
            {installments} × {formatCurrency(Math.round(parseFloat(amount) / installments * 100) / 100)} — taksit planı ve her ayın kart kaydı oluşturulur.
            Toplam tutarı gir.
          </p>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>İptal</Button>
        <Button onClick={save} disabled={!canSave || mut.isPending}>
          {mut.isPending ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </DialogFooter>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Yatırım Form (Storage → Investment)
// ---------------------------------------------------------------------------
function YatirimForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data: storages = [] }    = useQuery({ queryKey: ["boxes", "storages"], queryFn: () => getBoxes("storages") })
  const { data: investments = [] } = useQuery({ queryKey: ["boxes", "investments"], queryFn: () => getBoxes("investments") })

  const [frombox, setFrombox] = useState(0)
  const [tobox, setTobox]     = useState(0)
  const [amount, setAmount]   = useState("")
  const [date, setDate]       = useState(today())
  const [desc, setDesc]       = useState("")
  const [error, setError]     = useState("")

  const mut = useMutation({
    mutationFn: addTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] })
      qc.invalidateQueries({ queryKey: ["balances"] })
      qc.invalidateQueries({ queryKey: ["flows"] })
      onClose()
    },
    onError: (e: Error) => setError(e.message || "Kayıt hatası"),
  })

  const canSave = frombox > 0 && tobox > 0 && parseFloat(amount) > 0

  function save() {
    if (!canSave) return
    setError("")
    mut.mutate({ date, frombox, tobox, description: desc || "Yatırım", amount: parseFloat(amount), info: {} })
  }

  return (
    <div className="space-y-4">
      <CommonFields
        amount={amount} date={date} description={desc}
        onAmountChange={setAmount} onDateChange={setDate} onDescriptionChange={setDesc}
      />
      <div>
        <Label className="text-xs text-muted-foreground">Hangi Hesaptan *</Label>
        <div className="mt-2">
          {storages.length === 0
            ? <p className="text-xs text-muted-foreground">Ayarlar'dan hesap ekleyin.</p>
            : <BoxPills boxes={storages} value={frombox} onChange={setFrombox} />}
        </div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Yatırım Hesabı *</Label>
        <div className="mt-2">
          {investments.length === 0
            ? <p className="text-xs text-muted-foreground">Ayarlar'dan yatırım hesabı ekleyin.</p>
            : <BoxPills boxes={investments} value={tobox} onChange={setTobox} />}
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>İptal</Button>
        <Button onClick={save} disabled={!canSave || mut.isPending}>
          {mut.isPending ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </DialogFooter>
    </div>
  )
}

// ---------------------------------------------------------------------------
// KK Ödeme Form (Storage → CreditCard)
// ---------------------------------------------------------------------------
function CcPaymentForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data: storages = [] }    = useQuery({ queryKey: ["boxes", "storages"], queryFn: () => getBoxes("storages") })
  const { data: creditCards = [] } = useQuery({ queryKey: ["boxes", "creditcards"], queryFn: () => getBoxes("creditcards") })

  const [frombox, setFrombox] = useState(0)
  const [tobox, setTobox]     = useState(0)
  const [amount, setAmount]   = useState("")
  const [date, setDate]       = useState(today())
  const [desc, setDesc]       = useState("")
  const [error, setError]     = useState("")

  const mut = useMutation({
    mutationFn: addTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] })
      qc.invalidateQueries({ queryKey: ["balances"] })
      qc.invalidateQueries({ queryKey: ["summaries"] })
      qc.invalidateQueries({ queryKey: ["flows"] })
      onClose()
    },
    onError: (e: Error) => setError(e.message || "Kayıt hatası"),
  })

  const canSave = frombox > 0 && tobox > 0 && parseFloat(amount) > 0

  function save() {
    if (!canSave) return
    setError("")
    mut.mutate({ date, frombox, tobox, description: desc || "KK Ödeme", amount: parseFloat(amount), info: {} })
  }

  return (
    <div className="space-y-4">
      <CommonFields
        amount={amount} date={date} description={desc}
        onAmountChange={setAmount} onDateChange={setDate} onDescriptionChange={setDesc}
      />
      <div>
        <Label className="text-xs text-muted-foreground">Hangi Hesaptan *</Label>
        <div className="mt-2"><BoxPills boxes={storages} value={frombox} onChange={setFrombox} /></div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Hangi Karta *</Label>
        <div className="mt-2"><BoxPills boxes={creditCards} value={tobox} onChange={setTobox} /></div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>İptal</Button>
        <Button onClick={save} disabled={!canSave || mut.isPending}>
          {mut.isPending ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </DialogFooter>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Transfer Form (Storage/Investment ↔ Storage/Investment)
// ---------------------------------------------------------------------------
function TransferForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data: storages = [] }     = useQuery({ queryKey: ["boxes", "storages"], queryFn: () => getBoxes("storages") })
  const { data: investments = [] }  = useQuery({ queryKey: ["boxes", "investments"], queryFn: () => getBoxes("investments") })

  const allAccounts = useMemo(() => [...storages, ...investments], [storages, investments])

  const [frombox, setFrombox] = useState(0)
  const [tobox, setTobox]     = useState(0)
  const [amount, setAmount]   = useState("")
  const [date, setDate]       = useState(today())
  const [desc, setDesc]       = useState("")
  const [error, setError]     = useState("")

  const toOptions = useMemo(() => allAccounts.filter(b => b.id !== frombox), [allAccounts, frombox])

  const mut = useMutation({
    mutationFn: addTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] })
      qc.invalidateQueries({ queryKey: ["balances"] })
      qc.invalidateQueries({ queryKey: ["flows"] })
      onClose()
    },
    onError: (e: Error) => setError(e.message || "Kayıt hatası"),
  })

  const canSave = frombox > 0 && tobox > 0 && parseFloat(amount) > 0

  function save() {
    if (!canSave) return
    setError("")
    mut.mutate({ date, frombox, tobox, description: desc || "Transfer", amount: parseFloat(amount), info: {} })
  }

  return (
    <div className="space-y-4">
      <CommonFields
        amount={amount} date={date} description={desc}
        onAmountChange={setAmount} onDateChange={setDate} onDescriptionChange={setDesc}
      />
      <div>
        <Label className="text-xs text-muted-foreground">Nereden *</Label>
        <div className="mt-2">
          <BoxPills boxes={allAccounts} value={frombox} onChange={(id) => { setFrombox(id); if (id === tobox) setTobox(0) }} />
        </div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Nereye *</Label>
        <div className="mt-2">
          <BoxPills boxes={toOptions} value={tobox} onChange={setTobox} />
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>İptal</Button>
        <Button onClick={save} disabled={!canSave || mut.isPending}>
          {mut.isPending ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </DialogFooter>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Taksit Öde Form
// ---------------------------------------------------------------------------
function TaksitOdeForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["installment-plans"],
    queryFn: getInstallmentPlans,
  })

  const activePlans = useMemo(
    () => plans.filter(p => (p.first_no ?? 1) + (p.paid_count ?? 0) <= p.total_installments),
    [plans]
  )

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [date, setDate] = useState(today())
  const [error, setError] = useState("")

  const selected = activePlans.find(p => p.id === selectedId) ?? null

  const mut = useMutation({
    mutationFn: addTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] })
      qc.invalidateQueries({ queryKey: ["balances"] })
      qc.invalidateQueries({ queryKey: ["summaries"] })
      qc.invalidateQueries({ queryKey: ["flows"] })
      qc.invalidateQueries({ queryKey: ["installment-plans"] })
      onClose()
    },
    onError: (e: Error) => setError(e.message || "Kayıt hatası"),
  })

  function save() {
    if (!selected || !selected.payment_box_id) return
    setError("")
    const no = Math.min((selected.first_no ?? 1) + (selected.paid_count ?? 0), selected.total_installments)
    mut.mutate({
      date,
      frombox: selected.payment_box_id,
      tobox: selected.expense_box_id,
      description: `${selected.description} taksit`,
      amount: parseFloat(selected.amount_per_month),
      info: {
        plan_id: String(selected.id),
        installment_no: String(no),
      },
    })
  }

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Yükleniyor...</p>

  if (activePlans.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <p className="text-sm text-muted-foreground">Aktif taksit planı yok.</p>
        <p className="text-xs text-muted-foreground">Plan sayfasından yeni plan oluşturun.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs text-muted-foreground">Taksit Planı *</Label>
        <div className="mt-2 space-y-2">
          {activePlans.map(plan => {
            const noSource = !plan.payment_box_id
            return (
              <button
                key={plan.id}
                type="button"
                disabled={noSource}
                onClick={() => setSelectedId(plan.id)}
                className={cn(
                  "w-full flex items-center justify-between rounded-xl border p-3 text-left transition-all",
                  noSource && "opacity-40 cursor-not-allowed",
                  selectedId === plan.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{plan.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {plan.expense_name}
                    {plan.payment_box_name
                      ? <span className="ml-1">· {plan.payment_box_name}</span>
                      : <span className="ml-1 text-amber-500">· kaynak seçilmemiş</span>}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-sm font-mono font-medium">{formatCurrency(plan.amount_per_month)}</p>
                  <p className="text-[10px] text-muted-foreground">{(plan.first_no ?? 1) - 1 + (plan.paid_count ?? 0)}/{plan.total_installments} ödendi</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {selected && (
        <div>
          <Label className="text-xs text-muted-foreground">Tarih</Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1" />
          <p className="text-xs text-muted-foreground mt-1.5">
            {selected.payment_box_name} → {selected.expense_name} · {formatCurrency(selected.amount_per_month)}
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>İptal</Button>
        <Button onClick={save} disabled={!selected || !selected.payment_box_id || mut.isPending}>
          {mut.isPending ? "Kaydediliyor..." : selected ? `${formatCurrency(selected.amount_per_month)} Öde` : "Öde"}
        </Button>
      </DialogFooter>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Kart Bonusu / İadesi Form (Generator → CreditCard)
// ---------------------------------------------------------------------------
function KartBonusuForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data: generators = [] }   = useQuery({ queryKey: ["boxes", "generators"],   queryFn: () => getBoxes("generators") })
  const { data: creditCards = [] }  = useQuery({ queryKey: ["boxes", "creditcards"],  queryFn: () => getBoxes("creditcards") })

  const generatorId = useMemo(() => generators[0]?.id ?? 0, [generators])

  const [tobox, setTobox]   = useState(0)
  const [amount, setAmount] = useState("")
  const [date, setDate]     = useState(today())
  const [desc, setDesc]     = useState("")
  const [error, setError]   = useState("")

  const mut = useMutation({
    mutationFn: addTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] })
      qc.invalidateQueries({ queryKey: ["balances"] })
      qc.invalidateQueries({ queryKey: ["summaries"] })
      qc.invalidateQueries({ queryKey: ["flows"] })
      onClose()
    },
    onError: (e: Error) => setError(e.message || "Kayıt hatası"),
  })

  const canSave = generatorId > 0 && tobox > 0 && parseFloat(amount) > 0

  function save() {
    if (!canSave) return
    setError("")
    mut.mutate({ date, frombox: generatorId, tobox, description: desc || "Kart Bonusu", amount: parseFloat(amount), info: {} })
  }

  return (
    <div className="space-y-4">
      <CommonFields
        amount={amount} date={date} description={desc}
        onAmountChange={setAmount} onDateChange={setDate} onDescriptionChange={setDesc}
      />
      <div>
        <Label className="text-xs text-muted-foreground">Hangi Karta *</Label>
        <div className="mt-2">
          {creditCards.length === 0
            ? <p className="text-xs text-muted-foreground">Ayarlar'dan kredi kartı ekleyin.</p>
            : <BoxPills boxes={creditCards} value={tobox} onChange={setTobox} />}
        </div>
      </div>
      {generatorId === 0 && (
        <p className="text-xs text-amber-500">Dış Kaynak (Generator) kutusu bulunamadı.</p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>İptal</Button>
        <Button onClick={save} disabled={!canSave || mut.isPending}>
          {mut.isPending ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </DialogFooter>
    </div>
  )
}

// ---------------------------------------------------------------------------
// İade / Geri Ödeme Form (ExpenseType → Storage)
// ---------------------------------------------------------------------------
function IadeForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data: expenseTypes = [] } = useQuery({ queryKey: ["boxes", "expensetypes"], queryFn: () => getBoxes("expensetypes") })
  const { data: storages = [] }     = useQuery({ queryKey: ["boxes", "storages"],     queryFn: () => getBoxes("storages") })

  const [frombox, setFrombox] = useState(0)
  const [tobox, setTobox]     = useState(0)
  const [amount, setAmount]   = useState("")
  const [date, setDate]       = useState(today())
  const [desc, setDesc]       = useState("")
  const [error, setError]     = useState("")

  const mut = useMutation({
    mutationFn: addTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] })
      qc.invalidateQueries({ queryKey: ["balances"] })
      qc.invalidateQueries({ queryKey: ["summaries"] })
      qc.invalidateQueries({ queryKey: ["flows"] })
      onClose()
    },
    onError: (e: Error) => setError(e.message || "Kayıt hatası"),
  })

  const canSave = frombox > 0 && tobox > 0 && parseFloat(amount) > 0

  function save() {
    if (!canSave) return
    setError("")
    mut.mutate({ date, frombox, tobox, description: desc || "İade", amount: parseFloat(amount), info: { type: "refund" } })
  }

  return (
    <div className="space-y-4">
      <CommonFields
        amount={amount} date={date} description={desc}
        onAmountChange={setAmount} onDateChange={setDate} onDescriptionChange={setDesc}
      />
      <div>
        <Label className="text-xs text-muted-foreground">Hangi Kategoriden İade *</Label>
        <div className="mt-2">
          {expenseTypes.length === 0
            ? <p className="text-xs text-muted-foreground">Ayarlar'dan gider türü ekleyin.</p>
            : <BoxPills boxes={expenseTypes} value={frombox} onChange={setFrombox} />}
        </div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Hangi Hesaba Döndü *</Label>
        <div className="mt-2">
          {storages.length === 0
            ? <p className="text-xs text-muted-foreground">Ayarlar'dan hesap ekleyin.</p>
            : <BoxPills boxes={storages} value={tobox} onChange={setTobox} />}
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>İptal</Button>
        <Button onClick={save} disabled={!canSave || mut.isPending}>
          {mut.isPending ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </DialogFooter>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main AddPage
// ---------------------------------------------------------------------------
type FormType = "income" | "harcama" | "kartharcama" | "ccpayment" | "transfer" | "yatirim" | "taksit" | "kartbonusu" | "iade" | null

const CARDS = [
  {
    type: "income" as FormType,
    title: "Gelir",
    description: "Maaş, kira, serbest gelir",
    icon: TrendingUp,
    bg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
    border: "border-emerald-500/20 hover:border-emerald-500/60",
  },
  {
    type: "harcama" as FormType,
    title: "Harcama",
    description: "Nakit veya havale ile ödeme",
    icon: ShoppingCart,
    bg: "bg-rose-500/10",
    iconColor: "text-rose-500",
    border: "border-rose-500/20 hover:border-rose-500/60",
  },
  {
    type: "kartharcama" as FormType,
    title: "Kart Harcaması",
    description: "Kredi kartıyla alışveriş",
    icon: CreditCard,
    bg: "bg-orange-500/10",
    iconColor: "text-orange-500",
    border: "border-orange-500/20 hover:border-orange-500/60",
  },
  {
    type: "ccpayment" as FormType,
    title: "Kart Ödemesi",
    description: "Kredi kartı borcunu öde",
    icon: CreditCard,
    bg: "bg-amber-500/10",
    iconColor: "text-amber-500",
    border: "border-amber-500/20 hover:border-amber-500/60",
  },
  {
    type: "transfer" as FormType,
    title: "Transfer",
    description: "Hesaplar arası para aktar",
    icon: ArrowLeftRight,
    bg: "bg-blue-500/10",
    iconColor: "text-blue-500",
    border: "border-blue-500/20 hover:border-blue-500/60",
  },
  {
    type: "yatirim" as FormType,
    title: "Yatırım",
    description: "Yatırım hesabına para aktar",
    icon: PiggyBank,
    bg: "bg-violet-500/10",
    iconColor: "text-violet-500",
    border: "border-violet-500/20 hover:border-violet-500/60",
  },
  {
    type: "taksit" as FormType,
    title: "Taksitli Harcama",
    description: "Aktif taksit planından ödeme yap",
    icon: Layers,
    bg: "bg-purple-500/10",
    iconColor: "text-purple-500",
    border: "border-purple-500/20 hover:border-purple-500/60",
  },
  {
    type: "kartbonusu" as FormType,
    title: "Kart Bonusu",
    description: "Banka bonusu veya iadesi karta yatırıldı",
    icon: Gift,
    bg: "bg-teal-500/10",
    iconColor: "text-teal-500",
    border: "border-teal-500/20 hover:border-teal-500/60",
  },
  {
    type: "iade" as FormType,
    title: "İade",
    description: "Market iadesi, geri ödenen borç, iptal edilen harcama",
    icon: Undo2,
    bg: "bg-cyan-500/10",
    iconColor: "text-cyan-500",
    border: "border-cyan-500/20 hover:border-cyan-500/60",
  },
]

const FORM_TITLES: Record<string, string> = {
  income:      "Gelir Ekle",
  harcama:     "Harcama",
  kartharcama: "Kart Harcaması",
  ccpayment:   "Kart Ödemesi",
  transfer:    "Transfer",
  yatirim:     "Yatırım",
  taksit:      "Taksitli Harcama",
  kartbonusu:  "Kart Bonusu / İadesi",
  iade:        "İade / Geri Ödeme",
}

export function AddPage() {
  const [open, setOpen] = useState<FormType>(null)

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <h1 className="text-xl font-semibold">İşlem Ekle</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Ne yapmak istiyorsunuz?</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
          {CARDS.map(({ type, title, description, icon: Icon, bg, iconColor, border }) => (
            <button
              key={type}
              onClick={() => setOpen(type)}
              className={cn(
                "flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-all",
                "hover:shadow-md active:scale-[0.98]",
                bg, border
              )}
            >
              <div className={cn("rounded-xl p-2.5 bg-white/10 dark:bg-black/10", iconColor)}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Form Dialogs */}
      {open && (
        <Dialog open={!!open} onOpenChange={o => !o && setOpen(null)}>
          <DialogContent className="relative max-w-sm">
            <DialogClose onClose={() => setOpen(null)} />
            <DialogHeader>
              <DialogTitle>{FORM_TITLES[open]}</DialogTitle>
            </DialogHeader>
            {open === "income"      && <IncomeForm        onClose={() => setOpen(null)} />}
            {open === "harcama"     && <HarcamaForm       onClose={() => setOpen(null)} />}
            {open === "kartharcama" && <KartHarcamasiForm onClose={() => setOpen(null)} />}
            {open === "ccpayment"   && <CcPaymentForm     onClose={() => setOpen(null)} />}
            {open === "transfer"    && <TransferForm      onClose={() => setOpen(null)} />}
            {open === "yatirim"     && <YatirimForm       onClose={() => setOpen(null)} />}
            {open === "taksit"      && <TaksitOdeForm     onClose={() => setOpen(null)} />}
            {open === "kartbonusu"  && <KartBonusuForm    onClose={() => setOpen(null)} />}
            {open === "iade"        && <IadeForm          onClose={() => setOpen(null)} />}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
