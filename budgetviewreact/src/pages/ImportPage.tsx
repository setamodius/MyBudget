import { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Upload, FileText, CheckCircle2, XCircle, ChevronRight } from "lucide-react"
import { getBoxes } from "@/api/boxes"
import { addTransaction, getTransactions } from "@/api/transactions"
import { getInstallmentPlans } from "@/api/installments"
import { parseAkbankCsv, type ParsedRow, type CsvMeta } from "@/lib/csvParser"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { cn, formatCurrency } from "@/lib/utils"
import type { Box } from "@/types"

// ---------------------------------------------------------------------------
// BoxPills (local, same pattern as AddPage)
// ---------------------------------------------------------------------------
function BoxPills({
  boxes,
  value,
  onChange,
}: {
  boxes: Box[]
  value: number
  onChange: (id: number) => void
}) {
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
// Types
// ---------------------------------------------------------------------------
type Step = "upload" | "review" | "result"

interface RowState {
  parsed: ParsedRow
  selected: boolean
  tobox: number
  isDuplicate: boolean
  plan_id: number
}

// ---------------------------------------------------------------------------
// Upload step
// ---------------------------------------------------------------------------
function UploadStep({
  onFile,
  error,
}: {
  onFile: (file: File) => void
  error: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) onFile(file)
    },
    [onFile]
  )

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8">
      <div
        className={cn(
          "w-full max-w-md rounded-2xl border-2 border-dashed transition-colors p-10 flex flex-col items-center gap-4 cursor-pointer",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-accent/30"
        )}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center">
          <p className="text-base font-semibold">CSV dosyasını buraya sürükleyin</p>
          <p className="text-sm text-muted-foreground mt-1">
            veya tıklayarak seçin
          </p>
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
            Akbank internet bankacılığı → Hesaplarım → Kredi Kartları →<br />
            Dönem İçi İşlemler → Excel/CSV İndir
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) onFile(file)
            e.target.value = ""
          }}
        />
      </div>
      {error && (
        <p className="mt-4 text-sm text-destructive text-center max-w-md">{error}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Result step
// ---------------------------------------------------------------------------
function ResultStep({
  ok,
  errors,
  onReset,
}: {
  ok: number
  errors: number
  onReset: () => void
}) {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8 gap-6">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-xl font-semibold">İçe Aktarım Tamamlandı</p>
        <p className="text-sm text-muted-foreground">
          {ok} işlem başarıyla eklendi
          {errors > 0 && `, ${errors} işlemde hata oluştu`}
        </p>
      </div>
      {errors > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <XCircle className="h-4 w-4 shrink-0" />
          {errors} işlem eklenemedi. API bağlantısını kontrol edin.
        </div>
      )}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onReset}>Yeni İçe Aktarım</Button>
        <Button onClick={() => navigate("/islemler")}>
          İşlemlere Git <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ImportContent — embeddable in another page (no outer header)
// ---------------------------------------------------------------------------
export function ImportContent() {
  const qc = useQueryClient()
  const [step, setStep] = useState<Step>("upload")
  const [meta, setMeta] = useState<CsvMeta | null>(null)
  const [rows, setRows] = useState<RowState[]>([])
  const [frombox, setFrombox] = useState(0)
  const [bulkCategory, setBulkCategory] = useState(0)
  const [parseError, setParseError] = useState("")
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [result, setResult] = useState<{ ok: number; errors: number } | null>(null)

  const { data: creditCards = [] } = useQuery({
    queryKey: ["boxes", "creditcards"],
    queryFn: () => getBoxes("creditcards"),
  })
  const { data: expenseTypes = [] } = useQuery({
    queryKey: ["boxes", "expensetypes"],
    queryFn: () => getBoxes("expensetypes"),
  })
  const { data: plans = [] } = useQuery({
    queryKey: ["installment-plans"],
    queryFn: getInstallmentPlans,
  })

  function handleFile(file: File) {
    setParseError("")
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const text = e.target?.result as string
        const { meta, rows: parsed } = parseAkbankCsv(text)
        setMeta(meta)
        setRows(
          parsed.map(r => ({
            parsed: r,
            selected: !r.isPayment,
            tobox: 0,
            isDuplicate: false,
            plan_id: 0,
          }))
        )
        setStep("review")
      } catch (err) {
        setParseError((err as Error).message)
      }
    }
    reader.readAsText(file, "windows-1254")
  }

  useEffect(() => {
    if (frombox === 0 || rows.length === 0) return

    const dates = rows.map(r => r.parsed.date).sort()
    const start = dates[0]
    const end = dates[dates.length - 1]

    getTransactions({ from: frombox, start, end }).then(txs => {
      const keys = new Set(
        txs.map(t => `${t.date}|${parseFloat(t.amount).toFixed(2)}`)
      )
      setRows(prev =>
        prev.map(r => {
          const key = `${r.parsed.date}|${Math.abs(r.parsed.amount).toFixed(2)}`
          const isDuplicate = !r.parsed.isPayment && keys.has(key)
          return { ...r, isDuplicate, selected: isDuplicate ? false : r.selected }
        })
      )
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frombox, rows.length])

  // Auto-match installment rows to existing plans
  useEffect(() => {
    if (step !== "review" || plans.length === 0) return
    setRows(prev => {
      const hasUnmatched = prev.some(r => r.parsed.installment && r.plan_id === 0)
      if (!hasUnmatched) return prev
      return prev.map(row => {
        if (!row.parsed.installment || row.plan_id !== 0) return row
        const { total } = row.parsed.installment
        const amount = row.parsed.amount
        const matches = plans.filter(p =>
          p.total_installments === total &&
          Math.abs(parseFloat(p.amount_per_month) - amount) / amount < 0.02
        )
        if (matches.length !== 1) return row
        return {
          ...row,
          plan_id: matches[0].id,
          tobox: row.tobox === 0 ? matches[0].expense_box_id : row.tobox,
        }
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, plans])

  const selectedRows = useMemo(
    () => rows.filter(r => r.selected && !r.parsed.isPayment),
    [rows]
  )

  const readyToImport = useMemo(
    () => frombox > 0 && selectedRows.length > 0 && selectedRows.every(r => r.tobox > 0),
    [frombox, selectedRows]
  )

  const missingCategory = useMemo(
    () => selectedRows.filter(r => r.tobox === 0).length,
    [selectedRows]
  )

  function toggleAll(selected: boolean) {
    setRows(prev =>
      prev.map(r => (r.parsed.isPayment ? r : { ...r, selected }))
    )
  }

  function toggleRow(idx: number) {
    setRows(prev =>
      prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r))
    )
  }

  function setRowCategory(idx: number, tobox: number) {
    setRows(prev =>
      prev.map((r, i) => (i === idx ? { ...r, tobox } : r))
    )
  }

  function setRowPlan(idx: number, plan_id: number) {
    setRows(prev =>
      prev.map((r, i) => {
        if (i !== idx) return r
        const plan = plans.find(p => p.id === plan_id)
        return {
          ...r,
          plan_id,
          tobox: plan && r.tobox === 0 ? plan.expense_box_id : r.tobox,
        }
      })
    )
  }

  function applyBulkCategory() {
    if (!bulkCategory) return
    setRows(prev =>
      prev.map(r =>
        r.selected && !r.parsed.isPayment ? { ...r, tobox: bulkCategory } : r
      )
    )
  }

  async function handleImport() {
    const toImport = selectedRows.filter(r => r.tobox > 0)
    if (!toImport.length || frombox === 0) return

    setImporting(true)
    setImportProgress(0)

    let ok = 0
    let errors = 0

    for (let i = 0; i < toImport.length; i++) {
      const row = toImport[i]
      try {
        const info: Record<string, string> = {}
        if (row.parsed.installment) {
          info["Taksit"] = `${row.parsed.installment.current}/${row.parsed.installment.total}`
        }
        if (row.plan_id > 0 && row.parsed.installment) {
          info["plan_id"] = String(row.plan_id)
          info["installment_no"] = String(row.parsed.installment.current)
        }
        await addTransaction({
          date: row.parsed.date,
          frombox,
          tobox: row.tobox,
          description: row.parsed.description,
          amount: Math.abs(row.parsed.amount),
          info,
        })
        ok++
      } catch {
        errors++
      }
      setImportProgress(i + 1)
    }

    qc.invalidateQueries({ queryKey: ["transactions"] })
    qc.invalidateQueries({ queryKey: ["balances"] })
    qc.invalidateQueries({ queryKey: ["summaries"] })

    setResult({ ok, errors })
    setStep("result")
    setImporting(false)
  }

  function reset() {
    setStep("upload")
    setMeta(null)
    setRows([])
    setFrombox(0)
    setBulkCategory(0)
    setParseError("")
    setResult(null)
    setImportProgress(0)
  }

  const allNonPaymentSelected =
    rows.filter(r => !r.parsed.isPayment).every(r => r.selected) &&
    rows.some(r => !r.parsed.isPayment)

  return (
    <div className="flex flex-col">
      {step === "upload" && (
        <UploadStep onFile={handleFile} error={parseError} />
      )}

      {step === "result" && result && (
        <ResultStep ok={result.ok} errors={result.errors} onReset={reset} />
      )}

      {step === "review" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Config panel */}
          <div className="px-4 py-4 border-b border-border space-y-4 bg-card/30">
            {/* Card metadata banner */}
            {meta && (
              <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium">{meta.cardName}</span>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Kesim: {meta.periodEnd}</span>
                  <span>Borç: {meta.totalDebt}</span>
                </div>
              </div>
            )}

            {/* Credit card selector */}
            <div>
              <Label className="text-xs text-muted-foreground">
                Kredi Kartı (frombox) — tüm işlemlere uygulanır *
              </Label>
              <div className="mt-2">
                {creditCards.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Ayarlar'dan kredi kartı ekleyin.
                  </p>
                ) : (
                  <BoxPills boxes={creditCards} value={frombox} onChange={setFrombox} />
                )}
              </div>
            </div>

            {/* Bulk category */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">
                  Toplu Kategori — seçili işlemlere uygula
                </Label>
                <select
                  value={bulkCategory}
                  onChange={e => setBulkCategory(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value={0}>Kategori seçin...</option>
                  {expenseTypes.map(et => (
                    <option key={et.id} value={et.id}>{et.name}</option>
                  ))}
                </select>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={applyBulkCategory}
                disabled={!bulkCategory}
                className="mb-0.5"
              >
                Uygula
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            {/* Table header */}
            <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b border-border px-4 py-2 grid grid-cols-[2rem_1fr_auto_8rem] gap-2 items-center text-xs font-medium text-muted-foreground">
              <input
                type="checkbox"
                checked={allNonPaymentSelected}
                onChange={e => toggleAll(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <span>Açıklama / Tarih</span>
              <span className="text-right">Tutar</span>
              <span>Kategori</span>
            </div>

            {rows.map((row, idx) => (
              <div
                key={idx}
                className={cn(
                  "grid grid-cols-[2rem_1fr_auto_8rem] gap-2 items-center px-4 py-3 border-b border-border/50 text-sm transition-colors",
                  row.parsed.isPayment
                    ? "opacity-40 bg-muted/30"
                    : row.isDuplicate && !row.selected
                    ? "opacity-50 bg-muted/20"
                    : row.selected
                    ? "bg-background"
                    : "bg-muted/20 opacity-60"
                )}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={row.selected}
                  disabled={row.parsed.isPayment}
                  onChange={() => toggleRow(idx)}
                  className="h-4 w-4 rounded"
                />

                {/* Description + date */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="truncate font-medium text-xs leading-tight">
                      {row.parsed.description}
                    </span>
                    {row.parsed.installment && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                        {row.parsed.installment.current}/{row.parsed.installment.total}
                      </Badge>
                    )}
                    {row.parsed.isPayment && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                        Ödeme
                      </Badge>
                    )}
                    {row.isDuplicate && (
                      <Badge className="text-[10px] px-1.5 py-0 shrink-0 bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700">
                        Zaten Var
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{row.parsed.date}</p>
                  {row.parsed.installment && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[10px] text-muted-foreground shrink-0">Plan:</span>
                      <select
                        value={row.plan_id}
                        disabled={!row.selected}
                        onChange={e => setRowPlan(idx, Number(e.target.value))}
                        className={cn(
                          "text-[10px] rounded border bg-background px-1 py-0 focus:outline-none focus:ring-1 focus:ring-primary/50 max-w-[150px]",
                          row.plan_id > 0 ? "border-emerald-400 text-emerald-700 dark:text-emerald-400" : "border-border text-muted-foreground"
                        )}
                      >
                        <option value={0}>—</option>
                        {plans.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.description} ({p.total_installments} taksit)
                          </option>
                        ))}
                      </select>
                      {row.plan_id > 0 && (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                      )}
                    </div>
                  )}
                </div>

                {/* Amount */}
                <span
                  className={cn(
                    "text-right font-mono text-xs whitespace-nowrap",
                    row.parsed.isPayment ? "text-emerald-600" : "text-foreground"
                  )}
                >
                  {formatCurrency(row.parsed.amount)}
                </span>

                {/* Category select */}
                {row.parsed.isPayment ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  <select
                    value={row.tobox}
                    disabled={!row.selected}
                    onChange={e => setRowCategory(idx, Number(e.target.value))}
                    className={cn(
                      "w-full rounded-md border text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background",
                      row.selected && row.tobox === 0
                        ? "border-amber-400"
                        : "border-border"
                    )}
                  >
                    <option value={0}>—</option>
                    {expenseTypes.map(et => (
                      <option key={et.id} value={et.id}>{et.name}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>

          {/* Footer / import bar */}
          <div className="border-t border-border bg-card px-4 py-3 flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              {importing ? (
                <span>
                  İçe aktarılıyor... {importProgress}/
                  {selectedRows.filter(r => r.tobox > 0).length}
                </span>
              ) : (
                <span>
                  {selectedRows.length} işlem seçili
                  {missingCategory > 0 && (
                    <span className="text-amber-500 ml-2">
                      · {missingCategory} kategori eksik
                    </span>
                  )}
                  {rows.filter(r => r.isDuplicate).length > 0 && (
                    <span className="text-muted-foreground ml-2">
                      · {rows.filter(r => r.isDuplicate).length} zaten eklendi (devre dışı)
                    </span>
                  )}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={reset} disabled={importing}>
                Sıfırla
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={!readyToImport || importing}
              >
                {importing ? "Aktarılıyor..." : `İçe Aktar (${selectedRows.filter(r => r.tobox > 0).length})`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
