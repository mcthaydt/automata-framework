// A diagnostics summary as rows a panel can list: nested objects flattened to dotted names, a distribution (the shape `net`'s
// `Distribution.summary()` has) on one row, long fractions rounded. It knows no package's types: the port is `{ summary(): unknown }`.
export interface SummaryRow {
  readonly name: string
  readonly value: string
}

const DISTRIBUTION = ['count', 'last', 'min', 'p50', 'p95', 'max'] as const
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isDistribution = (v: Record<string, unknown>): boolean =>
  DISTRIBUTION.every((k) => typeof v[k] === 'number') && Object.keys(v).length === DISTRIBUTION.length
const num = (n: number): string => String(Math.round(n * 100) / 100)

export function summaryRows(summary: unknown, prefix = ''): SummaryRow[] {
  if (!isRecord(summary)) return []
  const rows: SummaryRow[] = []
  for (const key of Object.keys(summary)) {
    const name = prefix === '' ? key : `${prefix}.${key}`
    const value = summary[key]
    if (isRecord(value)) {
      if (isDistribution(value)) {
        const d = value as Record<(typeof DISTRIBUTION)[number], number>
        rows.push({
          name,
          value: `last ${num(d.last)} · p50 ${num(d.p50)} · p95 ${num(d.p95)} · max ${num(d.max)} (${d.count})`,
        })
      } else rows.push(...summaryRows(value, name))
    } else if (typeof value === 'number') rows.push({ name, value: num(value) })
    else if (value === null || value === undefined) rows.push({ name, value: '—' })
    else rows.push({ name, value: String(value) })
  }
  return rows
}
