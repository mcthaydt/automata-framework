import { counterIds } from '../../model/ids'
import type { Project } from '../../model/project-types'
import { levelProject } from './level-project'

/**
 * A fresh project from one of the editor's templates (`platformer`, `topdown-rpg`, `blank`), with the same ids every
 * time. It is what the editor starts a new level from, for the tools that need that start without opening an editor.
 */
export function newProject(templateId: string): Project {
  const template = levelProject.templates.find((candidate) => candidate.id === templateId)
  if (template === undefined) throw new Error(`There is no template "${templateId}".`)
  return template.create(counterIds())
}
