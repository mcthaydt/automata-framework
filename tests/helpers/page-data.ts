import { getExampleProject } from '../../src/data/projects'

/** What the home page's load function gives it: the starter project, as the real module has it. */
export const homeData = { starterProject: getExampleProject('base-2d')! }

/** What the gallery's load function gives it for a demo: the demo and its project. */
export function examplesData(demo: string, file?: string) {
  return { demo, project: getExampleProject(demo), ...(file ? { file } : {}) }
}
