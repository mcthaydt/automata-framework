// The small Markdown reader behind the docs pages. The guides (docs/guides/*.md) are written for GitHub's renderer
// and wrapped at 120 columns, so this reads the part of Markdown they use, the way GitHub would: headings, paragraphs,
// fenced code, tables, `> [!NOTE]` callouts, and lists whose items wrap onto indented lines and may hold a code block.
// Anything else is a paragraph. Inline text (code, bold, links) is `parseInline`'s, below; neither ever yields HTML.

export interface CodeSample {
  lang: string
  code: string
}

export interface ListItem {
  /** The item's words, its wrapped lines joined with spaces. */
  text: string
  /** A fenced block indented under the item, such as the config a step asks for. */
  code?: CodeSample
}

export type ParsedBlock =
  | { type: 'p'; content: string }
  | { type: 'h2' | 'h3'; content: string; headingId: string }
  | ({ type: 'code' } & CodeSample)
  | { type: 'callout'; calloutType: 'note' | 'tip' | 'warning' | 'important'; content: string }
  | { type: 'table'; tableHeaders: string[]; tableRows: string[][] }
  | { type: 'ul' | 'ol'; items: ListItem[] }

/** A heading's anchor, as GitHub makes it: lower case, letters, digits and dashes. "On this page" links to it. */
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

const BULLET = /^[-*]\s+/
const NUMBER = /^\d+\.\s+/
const CALLOUT = /^>\s*\[!(NOTE|TIP|WARNING|IMPORTANT)\]\s*(.*)$/i
const isTableRow = (line: string) => line.trim().startsWith('|') && line.trim().endsWith('|')
const cells = (row: string) =>
  row
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim())
/** A line that starts a block of its own, so it ends a paragraph. */
const startsBlock = (line: string) => /^(#|```|>|\|)/.test(line) || BULLET.test(line) || NUMBER.test(line)

/** Reads the lines one block at a time; each reader takes the lines it owns and says where the next block starts. */
export function parseMarkdown(md: string): ParsedBlock[] {
  const lines = md.split('\n')
  const blocks: ParsedBlock[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // A blank line separates blocks; the page draws the `#` title itself.
    if (!line.trim() || line.startsWith('# ')) i++
    else if (line.startsWith('```')) i = readCode(lines, i, blocks)
    else if (CALLOUT.test(line)) i = readCallout(lines, i, blocks)
    else if (line.startsWith('## ') || line.startsWith('### ')) {
      const text = line.replace(/^#+\s+/, '').trim()
      blocks.push({ type: line.startsWith('## ') ? 'h2' : 'h3', content: text, headingId: headingId(text) })
      i++
    } else if (isTableRow(line) && isTableRow(lines[i + 1] ?? '')) i = readTable(lines, i, blocks)
    else if (BULLET.test(line) || NUMBER.test(line)) i = readList(lines, i, blocks)
    else i = readParagraph(lines, i, blocks)
  }
  return blocks
}

/** A fenced block; `indent` is the list item's indentation it sits under, removed from each line. */
function fence(lines: readonly string[], at: number, indent = 0): { sample: CodeSample; next: number } {
  const lang = lines[at].trim().replace(/^```/, '').trim() || 'typescript'
  const code: string[] = []
  let i = at + 1
  while (i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i++].slice(indent))
  // Past the closing fence, if there is one: an unclosed block runs to the end, as on GitHub.
  return { sample: { lang, code: code.join('\n') }, next: i + 1 }
}

function readCode(lines: readonly string[], at: number, blocks: ParsedBlock[]): number {
  const { sample, next } = fence(lines, at)
  blocks.push({ type: 'code', ...sample })
  return next
}

function readCallout(lines: readonly string[], at: number, blocks: ParsedBlock[]): number {
  const match = CALLOUT.exec(lines[at]) as RegExpExecArray
  const text = match[2].trim() ? [match[2].trim()] : []
  let i = at + 1
  while (i < lines.length && lines[i].startsWith('>')) text.push(lines[i++].replace(/^>\s?/, ''))
  const calloutType = match[1].toLowerCase() as 'note' | 'tip' | 'warning' | 'important'
  blocks.push({ type: 'callout', calloutType, content: text.join('\n').trim() })
  return i
}

function readTable(lines: readonly string[], at: number, blocks: ParsedBlock[]): number {
  let i = at
  const rows: string[] = []
  while (i < lines.length && isTableRow(lines[i])) rows.push(lines[i++])
  // The second row is the `|---|` line under the headers.
  blocks.push({ type: 'table', tableHeaders: cells(rows[0]), tableRows: rows.slice(2).map(cells) })
  return i
}

/**
 * A list, one item per bullet or number. An indented line continues the item above it, a fenced block indented under
 * an item belongs to it, and a blank line ends the list only when what follows is not indented and not another item.
 */
function readList(lines: readonly string[], at: number, blocks: ParsedBlock[]): number {
  const marker = BULLET.test(lines[at]) ? BULLET : NUMBER
  const items: ListItem[] = []
  let i = at
  while (i < lines.length) {
    const line = lines[i]
    const indent = line.length - line.trimStart().length
    if (marker.test(line)) {
      items.push({ text: line.replace(marker, '').trim() })
      i++
    } else if (indent > 0 && line.trimStart().startsWith('```')) {
      const { sample, next } = fence(lines, i, indent)
      items[items.length - 1].code = sample
      i = next
    } else if (indent > 0 && line.trim()) {
      const item = items[items.length - 1]
      item.text = `${item.text} ${line.trim()}`
      i++
    } else if (!line.trim()) {
      const following = lines.slice(i).find((l) => l.trim()) ?? ''
      const continues = marker.test(following) || following.startsWith(' ')
      if (!continues) break
      i++
    } else break
  }
  blocks.push({ type: marker === BULLET ? 'ul' : 'ol', items })
  return i
}

function readParagraph(lines: readonly string[], at: number, blocks: ParsedBlock[]): number {
  const text = [lines[at]]
  let i = at + 1
  while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) text.push(lines[i++])
  blocks.push({ type: 'p', content: text.map((line) => line.trim()).join(' ') })
  return i
}

export type InlinePart =
  | { type: 'text' | 'code' | 'strong'; text: string }
  | { type: 'link'; text: string; href: string }

/** Inline text stays native Svelte content; raw HTML and executable URL schemes are never rendered. */
export function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = []
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g
  let start = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index! > start) parts.push({ type: 'text', text: text.slice(start, match.index) })
    if (match[1]) parts.push({ type: 'code', text: match[1] })
    else if (match[2]) parts.push({ type: 'strong', text: match[2] })
    else {
      const target = match[4]
      let safe = false
      try {
        const url = new URL(target, 'https://automataframework.com')
        safe =
          target.startsWith('https://') ||
          ((target.startsWith('/') || target.startsWith('#')) &&
            url.origin === 'https://automataframework.com' &&
            !target.includes('\\'))
      } catch {
        /* Malformed links remain ordinary text. */
      }
      parts.push(safe ? { type: 'link', text: match[3], href: target } : { type: 'text', text: match[0] })
    }
    start = match.index! + match[0].length
  }
  if (start < text.length) parts.push({ type: 'text', text: text.slice(start) })
  return parts
}
