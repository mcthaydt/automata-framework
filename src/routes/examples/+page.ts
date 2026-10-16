import { browser } from '$app/environment'
import { getDemoBySlug, getDemosCatalog } from '../../data/demos'
import { getExampleProject } from '../../data/projects'
import type { PageLoad } from './$types'
export const load: PageLoad = ({ url }) => {
  const demo = getDemoBySlug(browser ? url.searchParams.get('demo') ?? '' : '')?.slug ?? getDemosCatalog()[0]?.slug
  const requested = browser ? url.searchParams.get('file') : null
  const file = requested && demo && getExampleProject(demo)?.files.some(file => file.path === requested) ? requested : undefined
  return { demo, ...(file ? { file } : {}) }
}
