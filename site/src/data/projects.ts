import inventory from './projects.json'
import type { ExampleProject, ExampleSources, SourceFile } from './project-types'
export type { SourceFile } from './project-types'
/** A file whose content was left out of the page's data, to be fetched from `/sources/<slug>.json` when it is shown. */
export type DeferredFile = Omit<SourceFile, 'content'> & { deferred: true }
export type ProjectSource = Omit<ExampleProject, 'files'> & { files: (SourceFile | DeferredFile)[] }

const sources: ExampleSources = inventory
const files = new Map(sources.files.map(file => [file.path, file]))
const projects = new Map(sources.projects.map(project => [project.slug, {
  ...project,
  files: project.files.map(path => {
    const file = files.get(path)
    if (!file) throw new Error('Missing published example file: ' + path)
    return file
  }),
}]))

export function getExampleProject(slug: string): (Omit<ProjectSource, 'files'> & { files: SourceFile[] }) | undefined {
  return projects.get(slug)
}

/** Every project's slug, for the prerendered `/sources/<slug>.json`. */
export function exampleProjectSlugs(): string[] {
  return [...projects.keys()]
}

/** The project with only `keep`'s text content; the other text files are deferred. Binary assets carry none anyway. */
export function deferredProject(slug: string, keep: readonly string[]): ProjectSource | undefined {
  const project = projects.get(slug)
  if (!project) return undefined
  return {
    ...project,
    files: project.files.map(file =>
      keep.includes(file.path) || file.content === undefined ? file : { path: file.path, language: file.language, deferred: true as const }),
  }
}
