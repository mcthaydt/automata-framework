import type { PageLoad } from './$types'

// The example sources are 372 KB, every project in one module, and this page shows one. Importing the module here, on
// demand, keeps it out of the chunks the browser modulepreloads with the page, so it does not compete with the first paint.
export const load = (async () => {
  const { getExampleProject } = await import('../data/projects')
  return { starterProject: getExampleProject('base-2d')! }
}) satisfies PageLoad
