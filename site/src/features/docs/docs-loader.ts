import guides from 'virtual:framework/guides'
import { headingId } from '../../shared/utils/markdown'

// The docs pages are the framework's guides (`docs/guides/`, in the order of its index.md), read when the site is
// built (src/shared/framework/guides.ts). The site writes no docs of its own, so the docs and the framework cannot
// disagree; an address the site once used for its own pages gets the 404 page.

/** A heading of a guide, for its "On this page" list. */
export interface TocItem {
  id: string
  text: string
  level: 2 | 3
}

/** One page under `/docs/`. */
export interface DocSection {
  slug: string
  title: string
  /** The guide's first paragraph: the page's lead and meta description. */
  description: string
  /** The guide's Markdown below its heading. */
  content: string
  toc: TocItem[]
}

/** The `##` and `###` headings, with the ids `parseMarkdown` gives them. */
export function extractToc(markdown: string): TocItem[] {
  const toc: TocItem[] = []
  let inCode = false
  for (const line of markdown.split('\n')) {
    // A `#` comment inside a code block is not a heading.
    if (line.startsWith('```')) inCode = !inCode
    const match = inCode ? null : /^(#{2,3})\s+(.+)$/.exec(line)
    if (!match) continue
    const text = match[2].trim().replace(/`/g, '')
    toc.push({ id: headingId(text), text, level: match[1].length === 2 ? 2 : 3 })
  }
  return toc
}

const DOCS: DocSection[] = guides.map((guide) => ({
  slug: guide.slug,
  title: guide.title,
  description: guide.description,
  content: guide.content,
  toc: extractToc(guide.content),
}))

/** Every docs page, in the guides' order. */
export function getDocs(): DocSection[] {
  return DOCS
}

export function getDocBySlug(slug: string): DocSection | undefined {
  return DOCS.find((doc) => doc.slug === slug)
}
