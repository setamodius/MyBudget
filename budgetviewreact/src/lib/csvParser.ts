export interface ParsedRow {
  date: string
  description: string
  rawDescription: string
  amount: number
  isPayment: boolean
  installment?: { current: number; total: number }
}

export interface CsvMeta {
  cardName: string
  periodEnd: string
  totalDebt: string
}

function parseDate(raw: string): string {
  const parts = raw.trim().split(".")
  if (parts.length !== 3) return raw
  const [day, month, year] = parts
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
}

function parseAmount(raw: string): number {
  const cleaned = raw
    .trim()
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/\s*TL\s*/i, "")
    .trim()
  return parseFloat(cleaned)
}

const INSTALLMENT_RE = /\s*\((\d+)\/(\d+)\)\s*$/

export function parseAkbankCsv(text: string): { meta: CsvMeta; rows: ParsedRow[] } {
  const lines = text.split(/\r?\n/)

  const col1 = (line: string) => line.split(";")[1]?.trim() ?? ""

  const meta: CsvMeta = {
    cardName: col1(lines[0] ?? ""),
    periodEnd: col1(lines[1] ?? ""),
    totalDebt: col1(lines[2] ?? ""),
  }

  const headerIdx = lines.findIndex(l => l.startsWith("Tarih;"))
  if (headerIdx === -1) {
    throw new Error(
      "CSV formatı tanınamadı. 'Tarih;Açıklama;Tutar' başlık satırı bulunamadı."
    )
  }

  const rows: ParsedRow[] = []

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith("Akbank")) break

    const cols = line.split(";")
    if (cols.length < 3) continue

    const [rawDate, rawDesc, rawAmount] = cols
    if (!rawDate || !rawDesc || !rawAmount) continue

    const amount = parseAmount(rawAmount)
    if (isNaN(amount)) continue

    const installMatch = INSTALLMENT_RE.exec(rawDesc)
    const description = rawDesc.replace(INSTALLMENT_RE, "").replace(/\s+/g, " ").trim()

    rows.push({
      date: parseDate(rawDate.trim()),
      description,
      rawDescription: rawDesc.trim(),
      amount,
      isPayment: amount < 0,
      installment: installMatch
        ? { current: parseInt(installMatch[1]), total: parseInt(installMatch[2]) }
        : undefined,
    })
  }

  return { meta, rows }
}
