export interface ParsedBlock {
  type: 'p' | 'callout' | 'code' | 'h2' | 'h3' | 'table' | 'ul' | 'ol'
  content?: string
  calloutType?: 'note' | 'tip' | 'warning' | 'important'
  calloutTitle?: string
  code?: string
  lang?: string
  headingId?: string
  tableHeaders?: string[]
  tableRows?: string[][]
  listItems?: string[]
}

export function parseMarkdown(md: string): ParsedBlock[] {
  const lines = md.split('\n')
  const blocks: ParsedBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      i++
      continue
    }

    // Skip title h1 since it's in header
    if (line.startsWith('# ')) {
      i++
      continue
    }

    // Callout box (> [!NOTE], > [!TIP], etc.)
    const calloutMatch = line.match(/^>\s*\[!(NOTE|TIP|WARNING|IMPORTANT)\]\s*(.*)$/i)
    if (calloutMatch) {
      const type = calloutMatch[1].toLowerCase() as 'note' | 'tip' | 'warning' | 'important'
      const initialText = calloutMatch[2].trim()
      const textLines: string[] = initialText ? [initialText] : []
      i++
      while (i < lines.length && lines[i].startsWith('>')) {
        textLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      blocks.push({
        type: 'callout',
        calloutType: type,
        calloutTitle: type.toUpperCase(),
        content: textLines.join('\n').trim(),
      })
      continue
    }

    // Code blocks (```lang ... ```)
    if (line.startsWith('```')) {
      const lang = line.replace(/^```/, '').trim() || 'typescript'
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      if (i < lines.length && lines[i].startsWith('```')) {
        i++
      }
      blocks.push({
        type: 'code',
        lang,
        code: codeLines.join('\n'),
      })
      continue
    }

    // Headings (## or ###)
    if (line.startsWith('## ')) {
      const text = line.replace(/^##\s+/, '').trim()
      const headingId = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
      blocks.push({ type: 'h2', content: text, headingId })
      i++
      continue
    }

    if (line.startsWith('### ')) {
      const text = line.replace(/^###\s+/, '').trim()
      const headingId = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
      blocks.push({ type: 'h3', content: text, headingId })
      i++
      continue
    }

    // Table (| col | col |)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i])
        i++
      }
      if (tableLines.length >= 2) {
        const headerRow = tableLines[0]
          .split('|')
          .slice(1, -1)
          .map((s) => s.trim())
        const bodyRows = tableLines.slice(2).map((r) =>
          r
            .split('|')
            .slice(1, -1)
            .map((s) => s.trim()),
        )
        blocks.push({
          type: 'table',
          tableHeaders: headerRow,
          tableRows: bodyRows,
        })
        continue
      }
    }

    // Lists
    if (line.match(/^[-*]\s+/)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^[-*]\s+/)) {
        items.push(lines[i].replace(/^[-*]\s+/, '').trim())
        i++
      }
      blocks.push({ type: 'ul', listItems: items })
      continue
    }

    if (line.match(/^\d+\.\s+/)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        items.push(lines[i].replace(/^\d+\.\s+/, '').trim())
        i++
      }
      blocks.push({ type: 'ol', listItems: items })
      continue
    }

    // Paragraph fallback: always advances at least 1 line
    const pLines: string[] = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('>') &&
      !lines[i].startsWith('|') &&
      !lines[i].match(/^[-*]\s+/) &&
      !lines[i].match(/^\d+\.\s+/)
    ) {
      pLines.push(lines[i])
      i++
    }
    blocks.push({ type: 'p', content: pLines.join(' ') })
  }

  return blocks
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
