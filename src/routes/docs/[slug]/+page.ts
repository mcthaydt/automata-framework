import { getDocSections } from '../../../data/docs-loader'
import type { EntryGenerator, PageLoad } from './$types'

export const prerender = true

export const entries: EntryGenerator = () => {
  return getDocSections().map((section) => ({
    slug: section.slug,
  }))
}

export const load: PageLoad = ({ params }) => {
  return {
    slug: params.slug,
  }
}
