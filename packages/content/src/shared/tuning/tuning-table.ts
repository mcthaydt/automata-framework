// The generated tunable table in a game's authoring guide.
// Extracted from FloorFifty packages/content/src/author-guide.ts (122a220): a range that drifts between the
// declarations and the documentation is how an author comes to write a value the compiler refuses for a
// reason the guide denies, so the table is generated between markers and verified in CI. Pure functions:
// the CLI reads and writes the guide.

import type { TuningMeta } from './check-tuning'

export const BEGIN_MARKER = '<!-- BEGIN GENERATED TUNABLES -->'
export const END_MARKER = '<!-- END GENERATED TUNABLES -->'

/** Every tunable once, sorted by name, with its type, range and value in `content/tuning.toml`. */
export function renderTuningTable(meta: TuningMeta): string {
  const rows = Object.keys(meta)
    .sort()
    .map((name) => {
      const entry = meta[name]
      if (entry === undefined) return ''
      const range =
        entry.min === undefined || entry.max === undefined ? 'none' : `${entry.min} to ${entry.max}`
      return `| \`${name}\` | ${entry.type} | ${range} | ${String(entry.value)} |`
    })
  return [
    '| Name | Type | Inclusive range | Value in `content/tuning.toml` |',
    '| --- | --- | --- | --- |',
    ...rows,
  ].join('\n')
}

/** The guide with its generated section replaced, or undefined when it has no markers. */
export function withTuningTable(guide: string, meta: TuningMeta): string | undefined {
  const begin = guide.indexOf(BEGIN_MARKER)
  const end = guide.indexOf(END_MARKER)
  if (begin === -1 || end === -1 || end < begin) return undefined
  const head = guide.slice(0, begin + BEGIN_MARKER.length)
  const tail = guide.slice(end)
  return `${head}\n\n${renderTuningTable(meta)}\n\n${tail}`
}
