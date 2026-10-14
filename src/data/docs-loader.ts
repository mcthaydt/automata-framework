import docsJson from './docs.json'

export interface DocSection {
  id: string
  slug: string
  title: string
  description: string
  content: string
}

export const STATIC_DOCS: DocSection[] = docsJson as DocSection[]

export function getDocSections(): DocSection[] {
  return STATIC_DOCS
}

export function getDocBySlug(slug: string): DocSection | undefined {
  return STATIC_DOCS.find((s) => s.slug === slug || s.id === slug)
}
