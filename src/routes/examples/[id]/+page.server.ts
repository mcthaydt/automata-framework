import { error } from '@sveltejs/kit'
import { exampleIndex, getExample, getExamples } from '../../../data/examples'
import type { EntryGenerator, PageServerLoad } from './$types'

// One prerendered page per catalog example (PLAY-D9). A server load, so each page's data carries its own example and
// the source-free index; the other sources never reach the browser (QB.3h's rule for example sources).
export const entries = (() => getExamples().map(example => ({ id: example.id }))) satisfies EntryGenerator

export const load = (async ({ params }) => {
  const example = getExample(params.id)
  if (!example) error(404, 'No such example')
  return { example, index: exampleIndex() }
}) satisfies PageServerLoad
