// What a conversion could not carry across, and what it wrote. The converter is a record: it runs once, and its report
// says every thing the new level format could not say and what was done about it (`docs/convert-report.md`).

/** One thing the old data had that the new files could not say. */
export interface Unexpressed {
  /** What sort of thing: 'wall-member' | 'lamp-kind' | 'lamp-radius' | 'prop' | 'cutscene' | 'delivery' | 'bounce' | … */
  readonly kind: string
  /** Where it was: a room, a wall, a hotspot, a line. */
  readonly where: string
  /** What it was. */
  readonly what: string
  /** What was done: left out, written as something near it, or left for a person to finish. */
  readonly did: 'dropped' | 'approximated' | 'left-for-hand'
}

/** The files a conversion wrote (path under `content/`, then its text) and what it could not express. */
export interface Converted {
  readonly files: Readonly<Record<string, string>>
  readonly report: readonly Unexpressed[]
}

/** Two conversions as one; a path both wrote is a mistake, so it is refused in words. */
export function joined(...parts: readonly Converted[]): Converted {
  const files: Record<string, string> = {}
  const report: Unexpressed[] = []
  for (const part of parts) {
    for (const [path, text] of Object.entries(part.files)) {
      if (Object.hasOwn(files, path)) throw new Error(`Two conversions both wrote content/${path}.`)
      files[path] = text
    }
    report.push(...part.report)
  }
  return { files, report }
}

/** The report as a Markdown table, for `docs/convert-report.md`. */
export function reportTable(report: readonly Unexpressed[]): string {
  const rows = report.map((row) => `| ${row.kind} | ${row.where} | ${row.what} | ${row.did} |`)
  return ['| Kind | Where | What | Done |', '| --- | --- | --- | --- |', ...rows].join('\n')
}
