// A line diff for the Ask dialog (editor suite spec §9 `ask-diff`, EDS-D9: a proposal is one whole document). Myers'
// O(ND) shortest edit script over lines, grouped into unified hunks with three lines of context. A line keeps its end
// (`\n`, `\r\n` or none on the last line), so a line-end change shows as a change rather than vanishing.

export type DiffLine =
  | { readonly kind: 'same'; readonly text: string; readonly before: number; readonly after: number }
  | { readonly kind: 'removed'; readonly text: string; readonly before: number }
  | { readonly kind: 'added'; readonly text: string; readonly after: number }

/** A run of changes with its context; line numbers start at 1. */
export interface Hunk {
  readonly beforeStart: number
  readonly beforeCount: number
  readonly afterStart: number
  readonly afterCount: number
  readonly lines: readonly DiffLine[]
}

const CONTEXT = 3

/** `text` split after each `\n`, ends kept. */
const splitLines = (text: string): string[] => (text === '' ? [] : text.split(/(?<=\n)/))

/** A furthest-point table's entry; indexes are always in range, so `?? 0` never applies. */
const entry = (table: Int32Array, index: number): number => table[index] ?? 0

/** Every line of `a` and `b` in order as kept, removed or added: Myers' greedy search, then a walk back. */
function editScript(a: readonly string[], b: readonly string[]): DiffLine[] {
  const max = a.length + b.length
  const offset = max + 1
  const furthest = new Int32Array(2 * max + 3)
  const trace: Int32Array[] = []
  search: for (let d = 0; d <= max; d++) {
    trace.push(furthest.slice())
    for (let k = -d; k <= d; k += 2) {
      const down = k === -d || (k !== d && entry(furthest, offset + k - 1) < entry(furthest, offset + k + 1))
      let x = down ? entry(furthest, offset + k + 1) : entry(furthest, offset + k - 1) + 1
      let y = x - k
      while (x < a.length && y < b.length && a[x] === b[y]) {
        x++
        y++
      }
      furthest[offset + k] = x
      if (x >= a.length && y >= b.length) break search
    }
  }
  // Walk back from the end through each step's furthest points: a snake of kept lines, then one edit.
  const script: DiffLine[] = []
  let x = a.length
  let y = b.length
  for (let d = trace.length - 1; d >= 0; d--) {
    const before = trace[d] ?? furthest
    const k = x - y
    const down = k === -d || (k !== d && entry(before, offset + k - 1) < entry(before, offset + k + 1))
    const previousK = down ? k + 1 : k - 1
    const previousX = entry(before, offset + previousK)
    const previousY = previousX - previousK
    while (x > previousX && y > previousY) {
      script.push({ kind: 'same', text: a[x - 1] ?? '', before: x, after: y })
      x--
      y--
    }
    if (d === 0) break
    if (x === previousX) {
      y--
      script.push({ kind: 'added', text: b[y] ?? '', after: y + 1 })
    } else {
      x--
      script.push({ kind: 'removed', text: a[x] ?? '', before: x + 1 })
    }
  }
  return script.reverse()
}

/** The lines `before` became in `after`, as hunks; none when the texts are the same. */
export function lineDiff(before: string, after: string): Hunk[] {
  const script = editScript(splitLines(before), splitLines(after))
  // Each change keeps up to CONTEXT lines either side; changes whose context meets share a hunk.
  const ranges: [number, number][] = []
  script.forEach((line, index) => {
    if (line.kind === 'same') return
    const start = Math.max(0, index - CONTEXT)
    const end = Math.min(script.length, index + CONTEXT + 1)
    const last = ranges.at(-1)
    if (last !== undefined && start <= last[1]) last[1] = end
    else ranges.push([start, end])
  })
  return ranges.map(([start, end]) => hunkOf(script.slice(start, end), script, start))
}

function hunkOf(lines: DiffLine[], script: readonly DiffLine[], start: number): Hunk {
  // A side's start is its first line in the hunk, or the line after the last one before the hunk when it has none.
  let beforeStart = 1
  let afterStart = 1
  for (const line of script.slice(0, start)) {
    if (line.kind !== 'added') beforeStart = line.before + 1
    if (line.kind !== 'removed') afterStart = line.after + 1
  }
  return {
    beforeStart,
    beforeCount: lines.filter((line) => line.kind !== 'added').length,
    afterStart,
    afterCount: lines.filter((line) => line.kind !== 'removed').length,
    lines,
  }
}

/** The after side's added line numbers, in order: where a `before` check's findings on the candidate land. */
export function touchedLines(hunks: readonly Hunk[]): number[] {
  return hunks.flatMap((hunk) => hunk.lines.flatMap((line) => (line.kind === 'added' ? [line.after] : [])))
}
