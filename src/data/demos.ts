import demosJson from './demos.json'

export interface DemoItem {
  id: string
  slug: string
  title: string
  category: string
  shows: string
  controls: string
  base: string
  packages: string[]
  sourceCode: string
  bundleUrl: string
}

export const DEMOS_CATALOG: DemoItem[] = demosJson as DemoItem[]

export function getDemosCatalog(): DemoItem[] {
  return DEMOS_CATALOG
}

export function getDemoBySlug(slug: string): DemoItem | undefined {
  return DEMOS_CATALOG.find((d) => d.slug === slug || d.id === slug)
}

export const DEMO_CATEGORIES = [
  'All Examples',
  'Sim & Core',
  '2D Rendering',
  'Physics',
  'Mobile UI',
  'Runtime & Host',
  'Content',
]
