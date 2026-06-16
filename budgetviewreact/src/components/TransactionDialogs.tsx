import { useState, useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { updateTransaction, deleteTransaction } from "@/api/transactions"
import { getAllBoxes, getBoxTypes } from "@/api/boxes"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils"
import type { Transaction, TransactionFormData } from "@/types"

interface EditProps {
  target: Transaction | null
  onClose: () => void
}

export function EditTransactionDialog({ target, onClose }: EditProps) {
  const qc = useQueryClient()
  const [amount,     setAmount]     = useState(target?.amount ?? "")
  const [date,       setDate]       = useState(target?.date   ?? "")
  const [desc,       setDesc]       = useState(target?.description ?? "")
  const [fromTypeId, setFromTypeId] = useState("")
  const [toTypeId,   setToTypeId]   = useState("")
  const [fromBoxId,  setFromBoxId]  = useState("")
  const [toBoxId,    setToBoxId]    = useState("")

  const { data: allBoxes }  = useQuery({ queryKey: ["allBoxes"],  queryFn: getAllBoxes })
  const { data: boxTypes }  = useQuery({ queryKey: ["boxTypes"],  queryFn: getBoxTypes })

  useEffect(() => {
    if (!target || !allBoxes) return
    setAmount(target.amount)
    setDate(target.date)
    setDesc(target.description ?? "")
    setFromBoxId(String(target.frombox))
    setToBoxId(String(target.tobox))
    const fromBox = allBoxes.find(b => b.id === target.frombox)
    const toBox   = allBoxes.find(b => b.id === target.tobox)
    setFromTypeId(String(fromBox?.boxtypeid ?? ""))
    setToTypeId(String(toBox?.boxtypeid ?? ""))
  }, [target?.id, allBoxes])

  const boxTypeOptions = (boxTypes ?? []).map(bt => ({ value: bt.id, label: bt.name }))

  function boxOptions(typeId: string) {
    if (!allBoxes) return []
    const filtered = typeId
      ? allBoxes.filter(b => b.boxtypeid === Number(typeId))
      : allBoxes
    return filtered.map(b => ({ value: b.id, label: b.name }))
  }

  const mut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: TransactionFormData }) => updateTransaction(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] })
      qc.invalidateQueries({ queryKey: ["balances"] })
      qc.invalidateQueries({ queryKey: ["summaries"] })
      onClose()
    },
  })

  function save() {
    if (!target || !fromBoxId || !toBoxId) return
    mut.mutate({
      id: target.id,
      body: {
        date,
        frombox: Number(fromBoxId),
        tobox:   Number(toBoxId),
        description: desc,
        amount: parseFloat(amount),
        info: target.info ?? {},
      },
    })
  }

  const canSave = !!amount && parseFloat(amount) > 0 && !!fromBoxId && !!toBoxId

  return (
    <Dialog open={!!target} onOpenChange={o => !o && onClose()}>
      <DialogContent className="relative max-w-sm">
        <DialogClose onClose={onClose} />
        <DialogHeader><DialogTitle>İşlemi Düzenle</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Tutar *</Label>
            <Input
              type="number" step="0.01" min="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="mt-1 text-xl font-mono h-12 text-center"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Kaynak Tipi</Label>
              <Select
                options={boxTypeOptions}
                value={fromTypeId}
                placeholder="Tip seç"
                onChange={v => { setFromTypeId(v); setFromBoxId("") }}
              />
              <Select
                options={boxOptions(fromTypeId)}
                value={fromBoxId}
                placeholder="Kutu seç"
                onChange={setFromBoxId}
                disabled={!fromTypeId}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Hedef Tipi</Label>
              <Select
                options={boxTypeOptions}
                value={toTypeId}
                placeholder="Tip seç"
                onChange={v => { setToTypeId(v); setToBoxId("") }}
              />
              <Select
                options={boxOptions(toTypeId)}
                value={toBoxId}
                placeholder="Kutu seç"
                onChange={setToBoxId}
                disabled={!toTypeId}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Tarih</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Açıklama</Label>
              <Input value={desc} onChange={e => setDesc(e.target.value)} className="mt-1" />
            </div>
          </div>

          {mut.isError && <p className="text-xs text-destructive">Kayıt hatası</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>İptal</Button>
          <Button onClick={save} disabled={!canSave || mut.isPending}>
            {mut.isPending ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteProps {
  target: Transaction | null
  onClose: () => void
}

export function DeleteTransactionDialog({ target, onClose }: DeleteProps) {
  const qc = useQueryClient()

  const mut = useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] })
      qc.invalidateQueries({ queryKey: ["balances"] })
      qc.invalidateQueries({ queryKey: ["summaries"] })
      onClose()
    },
  })

  return (
    <Dialog open={!!target} onOpenChange={o => !o && onClose()}>
      <DialogContent className="relative">
        <DialogClose onClose={onClose} />
        <DialogHeader><DialogTitle>Silme Onayı</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Bu işlem kalıcı olarak silinecek. Emin misiniz?</p>
        {target && (
          <p className="text-sm font-medium">{formatCurrency(target.amount)} — {target.description}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>İptal</Button>
          <Button
            variant="destructive"
            onClick={() => target && mut.mutate(target.id)}
            disabled={mut.isPending}
          >
            {mut.isPending ? "Siliniyor..." : "Sil"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
