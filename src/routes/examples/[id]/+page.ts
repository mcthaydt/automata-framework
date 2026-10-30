import { error } from '@sveltejs/kit'
import type { EntryGenerator, PageLoad } from './$types'

// One prerendered page per catalog example (PLAY-D9). The catalog is imported on demand so the sources stay out of the
// chunks modulepreloaded with every page (QB.3h); each page's data carries its own example only.
export const entries = (async () => {
  const { getExamples } = await import('../../../data/examples')
  return getExamples().map(example => ({ id: example.id }))
}) satisfies EntryGenerator

export const load = (async ({ params }) => {
  const { exampleIndex, getExample } = await import('../../../data/examples')
  const example = getExample(params.id)
  if (!example) error(404, 'No such example')
  return { example, index: exampleIndex() }
}) satisfies PageLoad
