import type { Project } from '../../model/project-types'
import type { Diagnostic, ProjectContext, Severity } from '../profile'
import { definitionChecks } from './checks/definitions'
import { entityChecks } from './checks/entities'
import { levelChecksOf } from './checks/levels'
import { linkChecks } from './checks/links'

// The checks of the `level-project` profile (2D editor spec §9): one pure function over a project. Each group finds
// what its part of the document can get wrong; this puts them together, errors first, then warnings, then info, and
// within a severity in the order found (definitions, worlds and levels, entities, links), so the same project always
// lists the same way.

const RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 }

export function checkProject(project: Project, context: ProjectContext): Diagnostic[] {
  const found = [
    ...definitionChecks(project, context),
    ...levelChecksOf(project),
    ...entityChecks(project),
    ...linkChecks(project),
  ]
  // `Array.sort` is stable, so equal severities keep the order found.
  return found.sort((a, b) => RANK[a.severity] - RANK[b.severity])
}
