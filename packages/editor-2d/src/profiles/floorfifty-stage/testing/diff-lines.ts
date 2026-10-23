// A line diff for the codec tests: which lines of `before` are gone and which lines of `after` are new, by a longest
// common subsequence. The tests assert on the size and the text of the change, so that "exactly this line changed" is
// checked against the whole file and not against a slice the test chose.

export interface LineDiff {
  readonly removed: readonly { readonly line: number; readonly text: string }[]
  readonly added: readonly { readonly line: number; readonly text: string }[]
}

/** Lines count from 1. */
export function diffLines(before: string, after: string): LineDiff {
  const a = before.split(/\r?\n/)
  const b = after.split(/\r?\n/)
  // lcs[i][j]: the length of the common subsequence of a[i..] and b[j..].
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      const row = lcs[i] as number[]
      row[j] =
        a[i] === b[j]
          ? ((lcs[i + 1] as number[])[j + 1] as number) + 1
          : Math.max((lcs[i + 1] as number[])[j] as number, row[j + 1] as number)
    }
  }
  const removed: { line: number; text: string }[] = []
  const added: { line: number; text: string }[] = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++
      j++
    } else if (
      j < b.length &&
      (i === a.length || ((lcs[i] as number[])[j + 1] as number) >= ((lcs[i + 1] as number[])[j] as number))
    ) {
      added.push({ line: j + 1, text: b[j] as string })
      j++
    } else {
      removed.push({ line: i + 1, text: a[i] as string })
      i++
    }
  }
  return { removed, added }
}
