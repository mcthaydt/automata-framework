import docsJson from './docs.json'

export interface TocItem {
  id: string
  text: string
  level: number
}

export interface DocSection {
  id: string
  slug: string
  title: string
  category: string
  badge?: string
  description: string
  content: string
  toc: TocItem[]
}

export interface DocCategory {
  name: string
  items: DocSection[]
}

export const STATIC_DOCS: DocSection[] = docsJson as DocSection[]

export function getDocSections(): DocSection[] {
  return STATIC_DOCS
}

export function getDocBySlug(slug: string): DocSection | undefined {
  return STATIC_DOCS.find((s) => s.slug === slug || s.id === slug)
}

export function getDocCategories(): DocCategory[] {
  const map = new Map<string, DocSection[]>()
  for (const doc of STATIC_DOCS) {
    const list = map.get(doc.category) || []
    list.push(doc)
    map.set(doc.category, list)
  }
  return Array.from(map.entries()).map(([name, items]) => ({ name, items }))
}
