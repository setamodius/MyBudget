import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { getTransactions } from "@/api/transactions"
import { getAllBoxes } from "@/api/boxes"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatCurrency, monthsAgo, today, getFlowLabel } from "@/lib/utils"
import { ChevronRight, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, List, Layers } from "lucide-react"
import { EditTransactionDialog, DeleteTransactionDialog, InstallmentizeDialog } from "@/components/TransactionDialogs"
import type { Transaction } from "@/types"

const PERIODS = [
  { label: "Bu Ay",     start: () => monthsAgo(0),  end: () => today() },
  { label: "Son 3 Ay",  start: () => monthsAgo(2),  end: () => today() },
  { label: "Son 6 Ay",  start: () => monthsAgo(5),  end: () => today() },
  { label: "Son 1 Yıl", start: () => monthsAgo(11), end: () => today() },
  { label: "Tümü",      start: () => "2000-01-01",  end: () => "2100-12-31" },
]

type SortKey = "date" | "amount"
type SortDir = "desc" | "asc"

export function TransactionsPage() {
  const [periodIdx, setPeriodIdx] = useState(0)
  const [search, setSearch]       = useState("")
  const [sortKey, setSortKey]     = useState<SortKey>("date")
  const [sortDir, setSortDir]     = useState<SortDir>("desc")
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)
  const [editTarget, setEditTarget]     = useState<Transaction | null>(null)
  const [instTarget, setInstTarget]     = useState<Transaction | null>(null)

  const period = PERIODS[periodIdx]
  const start  = period.start()
  const end    = period.end()

  const { data: allBoxes = [] } = useQuery({ queryKey: ["boxes", "all"], queryFn: getAllBoxes })
  const { data: txRaw = [], isLoading } = useQuery({
    queryKey: ["transactions", "list", start, end],
    queryFn: () => getTransactions({ start, end }),
  })

  const boxMap     = useMemo(() => new Map(allBoxes.map(b => [b.id, b.name])),     [allBoxes])
  const boxTypeMap = useMemo(() => new Map(allBoxes.map(b => [b.id, b.boxtypeid])), [allBoxes])

  // Kart/hesaptan gidere yapılmış, henüz taksit planına bağlı olmayan harcamalar taksitlendirilebilir
  const canInstallmentize = (tx: Transaction) =>
    [2, 6].includes(boxTypeMap.get(tx.frombox) ?? 0) &&
    boxTypeMap.get(tx.tobox) === 3 &&
    !tx.info?.plan_id && !tx.info?.Taksit

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = q
      ? txRaw.filter(tx =>
          (tx.description ?? "").toLowerCase().includes(q) ||
          (boxMap.get(tx.frombox) ?? "").toLowerCase().includes(q) ||
          (boxMap.get(tx.tobox)   ?? "").toLowerCase().includes(q)
        )
      : txRaw

    list = [...list].sort((a, b) => {
      if (sortKey === "date") {
        const diff = a.date.localeCompare(b.date)
        return sortDir === "desc" ? -diff : diff
      } else {
        const diff = parseFloat(a.amount) - parseFloat(b.amount)
        return sortDir === "desc" ? -diff : diff
      }
    })

    return list
  }, [txRaw, search, sortKey, sortDir, boxMap])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc")
    else { setSortKey(key); setSortDir("desc") }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
    return sortDir === "desc"
      ? <ArrowDown className="h-3 w-3 text-primary" />
      : <ArrowUp   className="h-3 w-3 text-primary" />
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <h1 className="text-xl font-semibold">İşlemler</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Tüm kayıtları görüntüle, düzenle veya sil</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Dönem seçici */}
        <div className="flex gap-1.5 flex-wrap">
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

        {/* Arama */}
        <Input
          placeholder="Açıklama veya hesap ara..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9"
        />

        {/* Tablo */}
        <Card>
          <CardContent className="p-0">
            {/* Tablo başlığı */}
            <div className="grid grid-cols-[1fr_auto_auto] items-center px-4 py-2 border-b border-border bg-muted/40">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">İşlem</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleSort("date")}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
                >
                  Tarih <SortIcon k="date" />
                </button>
                <button
                  onClick={() => toggleSort("amount")}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors w-24 justify-end"
                >
                  Tutar <SortIcon k="amount" />
                </button>
                <div className="w-16" />
              </div>
            </div>

            {isLoading ? (
              <div className="divide-y divide-border/50">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="px-4 py-3 flex gap-3 animate-pulse">
                    <div className="h-4 w-16 bg-muted rounded" />
                    <div className="h-4 flex-1 bg-muted rounded" />
                    <div className="h-4 w-20 bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <List className="h-10 w-10 text-muted-foreground/25" />
                <p className="text-sm text-muted-foreground">
                  {search ? "Arama sonucu bulunamadı" : "Bu dönemde işlem yok"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {filtered.map(tx => {
                  const fromType = boxTypeMap.get(tx.frombox)
                  const toType   = boxTypeMap.get(tx.tobox)
                  const flow     = getFlowLabel(fromType, toType)
                  return (
                    <div key={tx.id} className="group grid grid-cols-[1fr_auto_auto] items-center gap-2 px-4 py-3 hover:bg-muted/20 transition-colors">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${flow.cls}`}>
                            {flow.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                          <span className="truncate">{boxMap.get(tx.frombox) ?? tx.frombox}</span>
                          <ChevronRight className="h-3 w-3 shrink-0" />
                          <span className="truncate">{boxMap.get(tx.tobox) ?? tx.tobox}</span>
                        </div>
                        {tx.description && (
                          <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{tx.description}</p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span className="text-[10px] text-muted-foreground font-mono">{tx.date}</span>
                        <span className="text-sm font-semibold font-mono">{formatCurrency(tx.amount)}</span>
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity">
                        {canInstallmentize(tx) && (
                          <Button variant="ghost" size="icon-sm" title="Taksitlendir" onClick={() => setInstTarget(tx)}>
                            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        )}
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

            {!isLoading && filtered.length > 0 && (
              <div className="px-4 py-2 border-t border-border bg-muted/20 flex justify-between text-xs text-muted-foreground">
                <span>{filtered.length} işlem</span>
                <span className="font-mono font-medium text-foreground">
                  {formatCurrency(filtered.reduce((s, tx) => s + parseFloat(tx.amount), 0))} toplam
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <EditTransactionDialog target={editTarget} onClose={() => setEditTarget(null)} />
      <DeleteTransactionDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} />
      <InstallmentizeDialog key={instTarget?.id ?? 0} target={instTarget} onClose={() => setInstTarget(null)} />
    </div>
  )
}
