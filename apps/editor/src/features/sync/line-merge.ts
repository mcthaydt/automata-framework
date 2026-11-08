// A three-way merge of text by lines, for files that have no structure to merge by (code, Markdown) and as the first
// try on TOML and JSON, because it keeps a file's comments and layout. Two changes that touch the same lines, or
// lines next to each other, are not merged: the caller asks the person.

/** A run of the base's lines (`start` up to `end`) that one side replaced with `lines`. */
interface Hunk {
  readonly start: number
  readonly end: number
  readonly lines: readonly string[]
}

/** Longest-common-subsequence work above this many cells is not attempted; the caller asks instead. */
const MAX_CELLS = 25_000_000

/** What `other` changed in `base`, as hunks in order, or `undefined` when the files are too big to compare. */
function hunksOf(base: readonly string[], other: readonly string[]): Hunk[] | undefined {
  let head = 0
  while (head < base.length && head < other.length && base[head] === other[head]) head++
  let tail = 0
  while (
    tail < base.length - head &&
    tail < other.length - head &&
    base[base.length - 1 - tail] === other[other.length - 1 - tail]
  )
    tail++
  const a = base.slice(head, base.length - tail)
  const b = other.slice(head, other.length - tail)
  if (a.length * b.length > MAX_CELLS) return undefined

  // table[i][j]: the length of the common run of a[i..] and b[j..].
  const width = b.length + 1
  const table = new Uint32Array((a.length + 1) * width)
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      table[i * width + j] =
        a[i] === b[j]
          ? (table[(i + 1) * width + j + 1] as number) + 1
          : Math.max(table[(i + 1) * width + j] as number, table[i * width + j + 1] as number)

  const hunks: Hunk[] = []
  let i = 0
  let j = 0
  let open: { start: number; lines: string[] } | undefined
  const close = (at: number): void => {
    if (open !== undefined) hunks.push({ start: head + open.start, end: head + at, lines: open.lines })
    open = undefined
  }
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      close(i)
      i++
      j++
    } else if (
      j < b.length &&
      (i === a.length || (table[i * width + j + 1] as number) >= (table[(i + 1) * width + j] as number))
    ) {
      open ??= { start: i, lines: [] }
      open.lines.push(b[j] as string)
      j++
    } else {
      open ??= { start: i, lines: [] }
      i++
    }
  }
  close(i)
  return hunks
}

const sameHunk = (a: Hunk, b: Hunk): boolean =>
  a.start === b.start &&
  a.end === b.end &&
  a.lines.length === b.lines.length &&
  a.lines.every((line, k) => line === b.lines[k])

/** The merged text, or `undefined` when the two sides changed the same lines (or lines that touch). */
export function mergeLines(base: string, mine: string, theirs: string): string | undefined {
  const split = (text: string): string[] => text.split('\n')
  const baseLines = split(base)
  const mineHunks = hunksOf(baseLines, split(mine))
  const theirHunks = hunksOf(baseLines, split(theirs))
  if (mineHunks === undefined || theirHunks === undefined) return undefined

  const out: string[] = []
  let at = 0
  let m = 0
  let t = 0
  const take = (hunk: Hunk): void => {
    out.push(...baseLines.slice(at, hunk.start), ...hunk.lines)
    at = hunk.end
  }
  while (m < mineHunks.length || t < theirHunks.length) {
    const mine1 = mineHunks[m]
    const their1 = theirHunks[t]
    if (
      mine1 !== undefined &&
      their1 !== undefined &&
      mine1.start <= their1.end &&
      their1.start <= mine1.end
    ) {
      if (!sameHunk(mine1, their1)) return undefined
      take(mine1)
      m++
      t++
    } else if (their1 === undefined || (mine1 !== undefined && mine1.start < their1.start)) {
      take(mine1 as Hunk)
      m++
    } else {
      take(their1)
      t++
    }
  }
  out.push(...baseLines.slice(at))
  return out.join('\n')
}
