import { browser } from '$app/environment'
import { getDemoBySlug, getDemosCatalog } from '../../data/demos'
import type { PageLoad } from './$types'

// The example sources are imported here, on demand, so they stay out of the chunks modulepreloaded with the page (QB.3h).
export const load = (async ({ url }) => {
  const { getExampleProject } = await import('../../data/projects')
  const demo = getDemoBySlug(browser ? url.searchParams.get('demo') ?? '' : '')?.slug ?? getDemosCatalog()[0]?.slug
  const project = demo ? getExampleProject(demo) : undefined
  const requested = browser ? url.searchParams.get('file') : null
  const file = requested && project?.files.some(file => file.path === requested) ? requested : undefined
  return { demo, project, ...(file ? { file } : {}) }
}) satisfies PageLoad
