import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react"
import {
  scanInstallments, createInstallmentPlan, updateInstallmentPlan, linkToPlan, fillPlanBudget,
} from "@/api/installments"
import { deleteTransaction } from "@/api/transactions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { cn, formatCurrency } from "@/lib/utils"
import type { Box, InstallmentScan, InstallmentScanGroup } from "@/types"

const ISSUE_LABELS: Record<string, string> = {
  no_plan: "Plan yok",
  multi_plan: "Birden fazla plana bağlı",
  plan_mismatch: "Plan ekstreyle uyuşmuyor",
  partial_link: "Bazı taksitler plana bağlı değil",
  mixed_category: "Taksitler farklı kategorilerde",
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })
}

function mode(nums: number[]) {
  const c = new Map<number, number>()
  nums.forEach(n => c.set(n, (c.get(n) ?? 0) + 1))
  let best = nums[0], bc = 0
  c.forEach((v, k) => { if (v > bc) { best = k; bc = v } })
  return best
}

interface GroupChoice {
  apply: boolean
  category: number
  description: string
  deleteLumps: Set<number>
}

interface PlanChoice {
  link: Set<number>
  fill: boolean
}

export function InstallmentRepair({ boxes, onDone }: { boxes: Box[]; onDone?: () => void }) {
  const { data, isFetching, refetch, error, dataUpdatedAt } = useQuery({
    queryKey: ["installment-scan"],
    queryFn: scanInstallments,
    staleTime: 0,
  })
  // Uygulama sonucu yeniden taramadan sonra da görünsün
  const [lastResult, setLastResult] = useState<string | null>(null)

  if (error) return <p className="text-sm text-destructive py-6 text-center">Tarama başarısız: {(error as Error).message}</p>
  if (!data) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Taksitler taranıyor...
      </div>
    )
  }
  // Her yeni taramada seçimler baştan kurulur
  return (
    <RepairBody
      key={dataUpdatedAt}
      data={data}
      boxes={boxes}
      isFetching={isFetching}
      refetch={async () => { await refetch() }}
      onDone={onDone}
      lastResult={lastResult}
      onResult={setLastResult}
    />
  )
}

function RepairBody({ data, boxes, isFetching, refetch, onDone, lastResult, onResult }: {
  data: InstallmentScan
  boxes: Box[]
  isFetching: boolean
  refetch: () => Promise<void>
  onDone?: () => void
  lastResult: string | null
  onResult: (msg: string) => void
}) {
  const qc = useQueryClient()
  const expenseBoxes = useMemo(() => boxes.filter(b => b.boxtypeid === 3), [boxes])

  const [groupChoices, setGroupChoices] = useState<Record<string, GroupChoice>>(() => {
    const gc: Record<string, GroupChoice> = {}
    for (const g of data.groups) {
      gc[g.key] = { apply: true, category: g.suggested_category, description: g.suggested_description, deleteLumps: new Set() }
    }
    return gc
  })
  const [planChoices, setPlanChoices] = useState<Record<number, PlanChoice>>(() => {
    const pc: Record<number, PlanChoice> = {}
    for (const p of data.plans) {
      pc[p.plan_id] = { link: new Set(p.candidates.map(c => c.id)), fill: p.missing_budget.length > 0 }
    }
    return pc
  })
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: [] as string[] })
  const [finished, setFinished] = useState(false)

  const groups = data.groups
  const plans = data.plans
  const active = groups.filter(g => !g.finished)
  const done = groups.filter(g => g.finished)

  const selectedCount =
    groups.filter(g => groupChoices[g.key]?.apply).length +
    plans.filter(p => (planChoices[p.plan_id]?.link.size ?? 0) > 0 || planChoices[p.plan_id]?.fill).length

  function setGroup(key: string, patch: Partial<GroupChoice>) {
    setGroupChoices(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  async function applyGroup(g: InstallmentScanGroup, c: GroupChoice) {
    if (g.action === "create") {
      const complete = g.min_no === 1 && g.max_no === g.total && g.txs.length === g.total
      await createInstallmentPlan({
        description: c.description || g.description,
        merchant: g.description,
        expense_box_id: c.category,
        payment_box_id: g.card,
        purchase_date: g.purchase_date,
        total_installments: g.total,
        amount_per_month: mode(g.txs.map(t => t.amount)),
        total_amount: complete ? Math.round(g.txs.reduce((s, t) => s + t.amount, 0) * 100) / 100 : undefined,
        first_no: g.min_no,
        link_tx_ids: g.tx_ids,
        replace_plan_ids: g.replace_plan_ids,
        delete_tx_ids: [...c.deleteLumps],
      })
    } else if (g.plan_id) {
      if (c.description && c.description !== g.plan_description) {
        await updateInstallmentPlan(g.plan_id, { description: c.description })
      }
      await updateInstallmentPlan(g.plan_id, { expense_box_id: c.category })
      await linkToPlan(g.plan_id, g.tx_ids)
      for (const id of c.deleteLumps) await deleteTransaction(id)
    }
  }

  async function applyAll() {
    const jobs: { label: string; run: () => Promise<void> }[] = []
    for (const g of groups) {
      const c = groupChoices[g.key]
      if (c?.apply) jobs.push({ label: g.description, run: () => applyGroup(g, c) })
    }
    for (const p of plans) {
      const c = planChoices[p.plan_id]
      if (!c) continue
      if (c.link.size) jobs.push({ label: `${p.description} bağla`, run: () => linkToPlan(p.plan_id, [...c.link]) })
      if (c.fill) jobs.push({ label: `${p.description} tamamla`, run: () => fillPlanBudget(p.plan_id) })
    }
    if (!jobs.length) return
    setRunning(true)
    setFinished(false)
    const errors: string[] = []
    setProgress({ done: 0, total: jobs.length, errors })
    for (let i = 0; i < jobs.length; i++) {
      try { await jobs[i].run() } catch { errors.push(jobs[i].label) }
      setProgress({ done: i + 1, total: jobs.length, errors: [...errors] })
    }
    setRunning(false)
    setFinished(true)
    onResult(errors.length
      ? `${jobs.length - errors.length}/${jobs.length} düzeltme uygulandı. Hata: ${errors.join(", ")}`
      : `${jobs.length} düzeltme uygulandı.`)
    for (const k of ["installment-plans", "transactions", "balances", "summaries", "flows"]) {
      qc.invalidateQueries({ queryKey: [k] })
    }
    await refetch()
    onDone?.()
  }

  const nothing = groups.length === 0 && plans.length === 0

  function renderGroup(g: InstallmentScanGroup) {
    const c = groupChoices[g.key]
    if (!c) return null
    const remaining = g.total - g.max_no
    return (
      <div key={g.key} className={cn("rounded-xl border p-3 space-y-2", c.apply ? "border-border" : "border-border/50 opacity-60")}>
        <div className="flex items-start gap-2">
          <input
            type="checkbox" className="h-4 w-4 mt-0.5 rounded" checked={c.apply}
            onChange={e => setGroup(g.key, { apply: e.target.checked })}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium truncate">{g.description}</span>
              <span className="text-xs text-muted-foreground">{g.card_name}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {g.total} × {formatCurrency(g.amount)} · alış {fmtDate(g.purchase_date)} ·{" "}
              {g.finished ? "tamamlandı" : `${remaining} taksit kaldı`}
            </p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {g.issues.map(i => (
                <Badge key={i} variant="warning" className="text-[10px] px-1.5 py-0">{ISSUE_LABELS[i] ?? i}</Badge>
              ))}
              {g.plan_description && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  Mevcut plan: {g.plan_description} ({g.plan_total} taksit)
                </Badge>
              )}
            </div>
          </div>
        </div>

        {c.apply && (
          <div className="pl-6 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input
                className="h-8 text-xs" value={c.description}
                onChange={e => setGroup(g.key, { description: e.target.value })}
                placeholder="Plan adı"
              />
              <Select
                className="h-8 text-xs"
                options={expenseBoxes.map(b => ({ value: b.id, label: b.name }))}
                value={c.category}
                onChange={v => setGroup(g.key, { category: Number(v) })}
              />
            </div>
            <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
              {g.txs.map(t => (
                <span key={t.id} className={cn(t.to_name !== expenseBoxes.find(b => b.id === c.category)?.name && "text-amber-600")}>
                  {t.no}/{g.total} {fmtDate(t.date)} · {t.to_name}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-sky-600 dark:text-sky-400">
              {g.action === "create"
                ? g.replace_plan_ids.length
                  ? `Eski plan silinip ${g.min_no}–${g.total}. taksitler için yeniden kurulacak; tüm taksitler seçilen kategoriye alınacak.`
                  : `${g.min_no}–${g.total}. taksitler için plan oluşturulacak; tüm taksitler seçilen kategoriye alınacak.`
                : "Taksitler plana bağlanacak ve seçilen kategoriye alınacak."}
            </p>
            {g.lumps.length > 0 && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 space-y-1">
                <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Bu alışveriş ayrıca tek tutar olarak girilmiş olabilir:
                </p>
                {g.lumps.map(l => (
                  <label key={l.id} className="flex items-center gap-2 text-[11px]">
                    <input
                      type="checkbox" className="h-3.5 w-3.5"
                      checked={c.deleteLumps.has(l.id)}
                      onChange={e => {
                        const s = new Set(c.deleteLumps)
                        if (e.target.checked) s.add(l.id); else s.delete(l.id)
                        setGroup(g.key, { deleteLumps: s })
                      }}
                    />
                    <span>Sil: {fmtDate(l.date)} · {l.description} · {formatCurrency(l.amount)} ({l.to_name})</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Ekstreden gelen taksitler alışverişlere göre gruplandı. Seçili düzeltmeler uygulanır.
        </p>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching || running}>
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1", isFetching && "animate-spin")} /> Yeniden tara
        </Button>
      </div>

      {lastResult && (
        <p className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
          {lastResult}
        </p>
      )}

      {nothing && (
        <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          Taksit kayıtları tutarlı, düzeltilecek bir şey yok.
        </div>
      )}

      {active.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Devam eden taksitler ({active.length})</h3>
          {active.map(renderGroup)}
        </section>
      )}

      {plans.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Elle girilmiş ödemeler / eksik plan satırları ({plans.length})</h3>
          {plans.map(p => {
            const c = planChoices[p.plan_id]
            if (!c) return null
            return (
              <div key={p.plan_id} className="rounded-xl border border-border p-3 space-y-2">
                <div>
                  <p className="text-sm font-medium">{p.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.expense_name}{p.payment_box_name && ` · ${p.payment_box_name}`} · {p.total_installments} × {formatCurrency(p.amount_per_month)}
                  </p>
                </div>
                {p.candidates.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">Bu plana ait görünen ödemeler (plana bağlanır):</p>
                    {p.candidates.map(cd => (
                      <label key={cd.id} className="flex items-center gap-2 text-[11px]">
                        <input
                          type="checkbox" className="h-3.5 w-3.5"
                          checked={c.link.has(cd.id)}
                          onChange={e => {
                            const s = new Set(c.link)
                            if (e.target.checked) s.add(cd.id); else s.delete(cd.id)
                            setPlanChoices(prev => ({ ...prev, [p.plan_id]: { ...c, link: s } }))
                          }}
                        />
                        <span>
                          {cd.installment_no}. taksit ← {fmtDate(cd.date)} · {cd.from_name} · {cd.description} · {formatCurrency(cd.amount)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {p.missing_budget.length > 0 && (
                  <label className="flex items-center gap-2 text-[11px]">
                    <input
                      type="checkbox" className="h-3.5 w-3.5" checked={c.fill}
                      onChange={e => setPlanChoices(prev => ({ ...prev, [p.plan_id]: { ...c, fill: e.target.checked } }))}
                    />
                    <span>Eksik taksit satırlarını tamamla: {p.missing_budget.join(", ")}. taksit</span>
                  </label>
                )}
              </div>
            )
          })}
        </section>
      )}

      {done.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Bitmiş taksitler ({done.length})</h3>
          <p className="text-[11px] text-muted-foreground">
            Gelecek ayları etkilemez; düzeltmek geçmiş ayların bütçe/taksit yükünü ve kategorilerini doğru gösterir.
          </p>
          {done.map(renderGroup)}
        </section>
      )}

      {!nothing && (
        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border -mx-1 px-1 py-3 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {running
              ? `Uygulanıyor... ${progress.done}/${progress.total}`
              : finished
                ? progress.errors.length
                  ? `Tamamlandı, ${progress.errors.length} hata: ${progress.errors.join(", ")}`
                  : "Tamamlandı."
                : `${selectedCount} düzeltme seçili`}
          </span>
          <Button size="sm" onClick={applyAll} disabled={running || selectedCount === 0}>
            {running ? "Uygulanıyor..." : "Seçilenleri Uygula"}
          </Button>
        </div>
      )}
    </div>
  )
}
