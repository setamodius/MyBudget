import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : (value ?? 0)
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(num)
}

export function formatMonth(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })
}

export function today(): string {
  return new Date().toISOString().split("T")[0]
}

export function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split("T")[0]
}

export function monthsAgo(n: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  d.setDate(1)
  return d.toISOString().split("T")[0]
}

export const FLOW_LABELS: Record<string, { label: string; cls: string }> = {
  "4-1": { label: "Gelir Planı",  cls: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  "1-6": { label: "Gelir",        cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  "1-7": { label: "Yatırım",      cls: "bg-violet-500/10 text-violet-500 border-violet-500/20" },
  "6-2": { label: "KK Ödeme",     cls: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  "6-7": { label: "Yatırıma",     cls: "bg-violet-500/10 text-violet-500 border-violet-500/20" },
  "6-3": { label: "Gider",        cls: "bg-rose-500/10 text-rose-500 border-rose-500/20" },
  "7-6": { label: "Çekim",        cls: "bg-teal-500/10 text-teal-500 border-teal-500/20" },
  "2-3": { label: "KK Harcama",   cls: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  "3-5": { label: "Gider Planı",  cls: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  "3-6": { label: "İade",         cls: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" },
}

export function getFlowLabel(fromType?: number, toType?: number): { label: string; cls: string } {
  return FLOW_LABELS[`${fromType}-${toType}`] ?? { label: "İşlem", cls: "bg-muted text-muted-foreground border-border" }
}
