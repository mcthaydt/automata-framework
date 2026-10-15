import { error } from '@sveltejs/kit'
import { getDocSections, getDocBySlug } from '../../../data/docs-loader'
import type { EntryGenerator, PageLoad } from './$types'

export const prerender = true

export const entries: EntryGenerator = () => {
  return getDocSections().map((section) => ({
    slug: section.slug,
  }))
}

export const load: PageLoad = ({ params }) => {
  if (!getDocBySlug(params.slug)) error(404, "Documentation not found")
  return {
    slug: params.slug,
  }
}
