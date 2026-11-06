import guides from 'virtual:framework/guides'
import { buildDocs, type DocSection } from './site-docs'

export type { DocSection } from './site-docs'

export interface DocCategory {
  name: string
  items: DocSection[]
}

// The site's pages and the framework's guides, read when the site is built (src/shared/framework/guides.ts).
const DOCS: DocSection[] = buildDocs(guides)

export function getDocSections(): DocSection[] {
  return DOCS
}

export function getDocBySlug(slug: string): DocSection | undefined {
  return DOCS.find((s) => s.slug === slug || s.id === slug)
}

export function getDocCategories(): DocCategory[] {
  const map = new Map<string, DocSection[]>()
  for (const doc of DOCS) {
    const list = map.get(doc.category) || []
    list.push(doc)
    map.set(doc.category, list)
  }
  return Array.from(map.entries()).map(([name, items]) => ({ name, items }))
}
