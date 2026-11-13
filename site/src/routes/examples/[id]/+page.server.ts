import { error } from '@sveltejs/kit'
import { highlightLines } from '../../../features/playground/highlight'
import {
  exampleIndex,
  getExample,
  getExamples,
  getScene,
  getScenes,
} from '../../../shared/framework/example-catalog'
import type { EntryGenerator, PageServerLoad } from './$types'

// One prerendered page per catalog example, and one per 3D example (none until the kits they import are public). A
// server load, so each page's data carries its own example and the source-free index; the other sources never reach the
// browser.
export const entries = (() =>
  [...getExamples(), ...getScenes()].map((example) => ({ id: example.id }))) satisfies EntryGenerator

export const load = (async ({ params }) => {
  const example = getExample(params.id) ?? getScene(params.id)
  if (!example) error(404, 'No such example')
  // Highlighted here, at prerender, so the parser never reaches the page's scripts.
  return { example, highlighted: highlightLines(example.source), index: exampleIndex() }
}) satisfies PageServerLoad
