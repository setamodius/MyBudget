import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getBalances } from "@/api/balances"
import { getAllBoxes } from "@/api/boxes"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { ChevronRight, Wallet } from "lucide-react"

export function HesaplarPage() {
  const navigate = useNavigate()

  const { data: balances = [], isLoading: balLoading } = useQuery({
    queryKey: ["balances"],
    queryFn: () => getBalances(),
  })
  const { data: allBoxes = [], isLoading: boxLoading } = useQuery({
    queryKey: ["boxes", "all"],
    queryFn: getAllBoxes,
  })

  const balanceMap = useMemo(
    () => new Map(balances.map(b => [b.id, parseFloat(b.balance)])),
    [balances],
  )

  const groups = useMemo(() => {
    const EXCLUDED_TYPES = new Set([4, 5]) // Generator, Destroyer
    const EXCLUDED_NAMES = new Set(["Void", "Dış Kaynak"])
    const TYPE_ORDER = [6, 7, 2, 1, 3]
    const TYPE_LABELS: Record<number, string> = {
      6: "Banka / Nakit",
      7: "Yatırımlar",
      2: "Kredi Kartları",
      1: "Gelir Hesapları",
      3: "Gider Kategorileri",
    }
    const grouped: Record<number, typeof allBoxes> = {}
    for (const box of allBoxes) {
      if (EXCLUDED_TYPES.has(box.boxtypeid) || EXCLUDED_NAMES.has(box.name)) continue
      grouped[box.boxtypeid] ??= []
      grouped[box.boxtypeid].push(box)
    }
    return TYPE_ORDER
      .filter(t => (grouped[t]?.length ?? 0) > 0)
      .map(t => ({ typeId: t, label: TYPE_LABELS[t], boxes: grouped[t] }))
  }, [allBoxes])

  const storTotal = balances.filter(b => b.boxtypeid === 6).reduce((s, b) => s + parseFloat(b.balance), 0)
  const ccDebt    = balances.filter(b => b.boxtypeid === 2).reduce((s, b) => s + Math.max(parseFloat(b.balance), 0), 0)
  const invTotal  = balances.filter(b => b.boxtypeid === 7).reduce((s, b) => s + parseFloat(b.balance), 0)

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <h1 className="text-xl font-semibold">Hesaplar</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Bakiyeler ve hesap detayları</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Summary chips */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Banka/Nakit</p>
              {balLoading
                ? <div className="h-5 rounded bg-muted animate-pulse mx-auto w-16" />
                : <p className="text-base font-bold font-mono">{formatCurrency(storTotal)}</p>
              }
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">KK Borcu</p>
              {balLoading
                ? <div className="h-5 rounded bg-muted animate-pulse mx-auto w-16" />
                : <p className={`text-base font-bold font-mono ${ccDebt > 0 ? "text-amber-500" : ""}`}>
                    {ccDebt > 0 ? `-${formatCurrency(ccDebt)}` : "₺0"}
                  </p>
              }
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Yatırımlar</p>
              {balLoading
                ? <div className="h-5 rounded bg-muted animate-pulse mx-auto w-16" />
                : <p className="text-base font-bold font-mono text-violet-500">{formatCurrency(invTotal)}</p>
              }
            </CardContent>
          </Card>
        </div>

        {/* Grouped box list */}
        {groups.map(({ typeId, label, boxes }) => (
          <div key={typeId}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">
              {label}
            </h2>
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              {boxes.map((box, i) => {
                const bal = balanceMap.get(box.id)
                const isCreditCard = typeId === 2
                return (
                  <button
                    key={box.id}
                    onClick={() => navigate(`/hesaplar/${box.id}`)}
                    className={`w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/20 transition-colors text-left ${i > 0 ? "border-t border-border/50" : ""}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{box.name}</p>
                      {box.settlement && isCreditCard && (
                        <p className="text-xs text-muted-foreground">Kesim günü: {box.settlement}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {bal !== undefined && (
                        <span className={`text-sm font-semibold font-mono ${
                          isCreditCard
                            ? bal > 0 ? "text-amber-500" : "text-emerald-500"
                            : bal < 0 ? "text-red-500" : ""
                        }`}>
                          {isCreditCard && bal > 0 ? "-" : ""}{formatCurrency(Math.abs(bal))}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {!boxLoading && groups.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Wallet className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Hesap bulunamadı</p>
            <p className="text-xs mt-1">Ayarlar'dan hesap ekleyin</p>
          </div>
        )}
      </div>
    </div>
  )
}
