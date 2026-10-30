import type { PageLoad } from './$types'

// The index carries no source: the catalog is imported here, on demand, and only the summaries reach the page's data.
// Any query (the retired gallery's ?demo=) gets this same prerendered page.
export const load = (async () => {
  const { exampleIndex } = await import('../../data/examples')
  return { index: exampleIndex() }
}) satisfies PageLoad
