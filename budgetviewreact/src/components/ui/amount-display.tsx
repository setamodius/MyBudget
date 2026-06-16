import { cn } from "@/lib/utils"

type ColorRule =
  | "signed"   // pozitif=yeşil, negatif=kırmızı, sıfır=muted
  | "debt"     // pozitif=kırmızı (borç var), sıfır/negatif=yeşil
  | "neutral"  // her zaman varsayılan renk

interface AmountDisplayProps {
  value: number | string
  colorRule?: ColorRule
  className?: string
}

function formatTRY(value: number) {
  return value.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })
}

export function AmountDisplay({ value, colorRule = "neutral", className }: AmountDisplayProps) {
  const num = typeof value === "string" ? parseFloat(value) : value
  const safe = isNaN(num) ? 0 : num

  const colorClass =
    colorRule === "signed"
      ? safe > 0
        ? "text-positive"
        : safe < 0
        ? "text-negative"
        : "text-muted-foreground"
      : colorRule === "debt"
      ? safe > 0
        ? "text-negative"
        : "text-positive"
      : ""

  return (
    <span className={cn(colorClass, className)}>{formatTRY(safe)}</span>
  )
}
