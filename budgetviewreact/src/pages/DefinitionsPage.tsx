import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getBoxes, addBox, updateBox, deleteBox } from "@/api/boxes"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Pencil, Trash2, Plus, PackageX, Upload } from "lucide-react"
import type { Box, BoxType, BoxFormData } from "@/types"
import { ImportContent } from "@/pages/ImportPage"

type Tab = { key: BoxType; label: string; isCC: boolean }

const TABS: Tab[] = [
  { key: "incomes", label: "Gelirler", isCC: false },
  { key: "creditcards", label: "Kredi Kartları", isCC: true },
  { key: "expensetypes", label: "Gider Türleri", isCC: false },
  { key: "storages", label: "Hesaplar", isCC: false },
  { key: "investments", label: "Yatırımlar", isCC: false },
]

const emptyForm: BoxFormData = { name: "", settlement: null, payment: null, minuslimit: null, pluslimit: null }

function BoxTable({ type, isCC }: { type: BoxType; isCC: boolean }) {
  const qc = useQueryClient()
  const { data: boxes = [], isLoading } = useQuery({ queryKey: ["boxes", type], queryFn: () => getBoxes(type) })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Box | null>(null)
  const [form, setForm] = useState<BoxFormData>(emptyForm)
  const [deleteConfirm, setDeleteConfirm] = useState<Box | null>(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: ["boxes", type] })

  const addMut = useMutation({ mutationFn: (d: BoxFormData) => addBox(type, d), onSuccess: () => { invalidate(); setDialogOpen(false) } })
  const updateMut = useMutation({ mutationFn: (d: { id: number; data: BoxFormData }) => updateBox(type, d.id, d.data), onSuccess: () => { invalidate(); setDialogOpen(false) } })
  const deleteMut = useMutation({ mutationFn: (id: number) => deleteBox(type, id), onSuccess: () => { invalidate(); setDeleteConfirm(null) } })

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(box: Box) {
    setEditing(box)
    setForm({ name: box.name, settlement: box.settlement, payment: box.payment, minuslimit: box.minuslimit, pluslimit: box.pluslimit })
    setDialogOpen(true)
  }

  function save() {
    if (!form.name.trim()) return
    if (editing) updateMut.mutate({ id: editing.id, data: form })
    else addMut.mutate(form)
  }

  const isBusy = addMut.isPending || updateMut.isPending
  const colSpan = isCC ? 6 : 4

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1.5" /> Yeni Ekle
        </Button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Ad</th>
                {isCC && (
                  <>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Hesap Günü</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Ödeme Günü</th>
                  </>
                )}
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Min Limit</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Max Limit</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading && [...Array(3)].map((_, i) => (
                <tr key={i}>
                  {[...Array(colSpan)].map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3.5 rounded bg-muted animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}
              {boxes.map((box) => (
                <tr key={box.id} className="group hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-sm">{box.name}</td>
                  {isCC && (
                    <>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{box.settlement ?? "—"}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{box.payment ?? "—"}</td>
                    </>
                  )}
                  <td className="px-4 py-2.5 text-right text-sm text-muted-foreground font-mono">{box.minuslimit ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right text-sm text-muted-foreground font-mono">{box.pluslimit ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(box)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleteConfirm(box)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && boxes.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-12 text-center">
                    <PackageX className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Henüz kayıt yok</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Yeni ekle butonunu kullanarak kayıt oluşturun</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="relative">
          <DialogClose onClose={() => setDialogOpen(false)} />
          <DialogHeader>
            <DialogTitle>{editing ? "Düzenle" : "Yeni Ekle"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Ad *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ad" className="mt-1" />
            </div>
            {isCC && (
              <>
                <div>
                  <Label>Hesap Kesim Günü</Label>
                  <Input type="number" value={form.settlement ?? ""} onChange={(e) => setForm({ ...form, settlement: e.target.value ? parseInt(e.target.value) : null })} className="mt-1" />
                </div>
                <div>
                  <Label>Ödeme Günü</Label>
                  <Input type="number" value={form.payment ?? ""} onChange={(e) => setForm({ ...form, payment: e.target.value ? parseInt(e.target.value) : null })} className="mt-1" />
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Min Limit</Label>
                <Input type="number" value={form.minuslimit ?? ""} onChange={(e) => setForm({ ...form, minuslimit: e.target.value ? parseFloat(e.target.value) : null })} className="mt-1" />
              </div>
              <div>
                <Label>Max Limit</Label>
                <Input type="number" value={form.pluslimit ?? ""} onChange={(e) => setForm({ ...form, pluslimit: e.target.value ? parseFloat(e.target.value) : null })} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={save} disabled={!form.name.trim() || isBusy}>
              {isBusy ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent className="relative">
          <DialogClose onClose={() => setDeleteConfirm(null)} />
          <DialogHeader>
            <DialogTitle>Silme Onayı</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{deleteConfirm?.name}</span> kalıcı olarak silinecek. Emin misiniz?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>İptal</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteMut.mutate(deleteConfirm.id)} disabled={deleteMut.isPending}>
              {deleteMut.isPending ? "Siliniyor..." : "Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

type AnyTab = BoxType | "import"

export function DefinitionsPage() {
  const [tab, setTab] = useState<AnyTab>("incomes")

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <h1 className="text-xl font-semibold">Ayarlar</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Tanımlar ve veri içe aktarma</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as AnyTab)} variant="underline">
          <TabsList className="mb-6">
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
            ))}
            <TabsTrigger value="import">
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              İçe Aktar
            </TabsTrigger>
          </TabsList>
          {TABS.map((t) => (
            <TabsContent key={t.key} value={t.key}>
              <BoxTable type={t.key} isCC={t.isCC} />
            </TabsContent>
          ))}
          <TabsContent value="import">
            <ImportContent />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
