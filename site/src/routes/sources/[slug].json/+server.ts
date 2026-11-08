import { error, json } from '@sveltejs/kit'
import { exampleProjectSlugs, getExampleProject } from '../../../data/projects'
import type { EntryGenerator, RequestHandler } from './$types'

// Each example project's files, prerendered to a static file. The home page carries one file's content; its source
// explorer fetches the rest from here the first time another file is chosen.
export const prerender = true
export const entries = (() => exampleProjectSlugs().map((slug) => ({ slug }))) satisfies EntryGenerator

export const GET = (({ params }) => {
  const project = getExampleProject(params.slug)
  if (!project) error(404, 'No such project')
  return json(project.files)
}) satisfies RequestHandler
