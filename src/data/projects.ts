import inventory from './projects.json'
import type { ExampleProject, ExampleSources, SourceFile } from './project-types'
export type { SourceFile } from './project-types'
export type ProjectSource = Omit<ExampleProject, 'files'> & { files: SourceFile[] }

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

export function getExampleProject(slug: string): ProjectSource | undefined {
  return projects.get(slug)
}
