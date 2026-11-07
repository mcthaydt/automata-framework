// The static code's highlighting, worked out at prerender with the editor's own parser and
// `classHighlighter`, so the static code and the editor carry the same `tok-*` classes and the swap changes no colour.
import { typescriptLanguage } from '@codemirror/lang-javascript'
import { classHighlighter, highlightTree } from '@lezer/highlight'

export interface HighlightedPiece {
  readonly text: string
  readonly className: string
}
/** One line's pieces; every line but the last ends with its newline, so the pieces join to the source. */
export type HighlightedLine = HighlightedPiece[]

export function highlightLines(source: string): HighlightedLine[] {
  const lines: HighlightedLine[] = [[]]
  const put = (from: number, to: number, className: string) => {
    // A token that spans lines (a block comment, a template string) is cut at each newline.
    for (const [index, part] of source
      .slice(from, to)
      .split(/(?<=\n)/)
      .entries()) {
      if (index > 0 && lines.at(-1)!.length > 0) lines.push([])
      if (part) lines.at(-1)!.push({ text: part, className })
    }
    if (source[to - 1] === '\n') lines.push([])
  }
  let at = 0
  highlightTree(typescriptLanguage.parser.parse(source), classHighlighter, (from, to, classes) => {
    if (from > at) put(at, from, '')
    put(from, to, classes)
    at = to
  })
  if (at < source.length) put(at, source.length, '')
  return lines
}
