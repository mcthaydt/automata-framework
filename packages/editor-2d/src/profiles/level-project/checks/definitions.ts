import { checkEntityDef } from '@mcthaydt/automata-editor-kit/fields'
import type { Project } from '../../../model/project-types'
import { tilesetTiles } from '../../../model/tileset-grid'
import { ruleIssues } from '../../../tiles/autotile/rule-issues'
import type { Diagnostic, ProjectContext } from '../../profile'
import { diagnostic } from './diagnostics'

// Checks of `defs` (2D editor spec §9, "Definitions"): tileset images, typed field definitions, auto-tile rules, and
// definitions nothing uses.

const RULE_CODES = {
  tileOutOfRange: 'ruleTileOutOfRange',
  valueUnknown: 'ruleValueUnknown',
  neverFires: 'ruleNeverMatches',
  shadowed: 'ruleShadowed',
} as const

function tilesetChecks(project: Project, context: ProjectContext): Diagnostic[] {
  const found: Diagnostic[] = []
  for (const set of project.defs.tilesets) {
    const path = `defs.tilesets[${set.id}]`
    if (set.image === undefined) continue
    if (context.assets !== undefined && !context.assets.includes(set.image)) {
      found.push(
        diagnostic(
          'warning',
          'missingTileset',
          path,
          `The image "${set.image}" of tileset "${set.label}" is not in the workspace, so numbered placeholder tiles stand in.`,
        ),
      )
    }
    const measured = context.imageSizes?.[set.image]
    if (measured !== undefined && (measured.w !== set.imageSize.w || measured.h !== set.imageSize.h)) {
      found.push(
        diagnostic(
          'warning',
          'tilesetImageChanged',
          path,
          `The image "${set.image}" is now ${measured.w} × ${measured.h} px; the project recorded ${set.imageSize.w} × ${set.imageSize.h}, so tile indices may point at other tiles.`,
        ),
      )
    }
  }
  return found
}

function fieldDefChecks(project: Project): Diagnostic[] {
  const found: Diagnostic[] = []
  for (const def of project.defs.entities) {
    for (const problem of checkEntityDef(def)) {
      const path =
        problem.fieldId === undefined
          ? `defs.entities[${def.id}]`
          : `defs.entities[${def.id}].fields[${problem.fieldId}]`
      found.push(diagnostic('error', 'fieldDefInvalid', path, problem.message))
    }
  }
  // The level fields are checked as the fields of one definition, which also finds a repeated id.
  for (const problem of checkEntityDef({ id: 'level', fields: project.defs.levelFields })) {
    const path = problem.fieldId === undefined ? 'defs.levelFields' : `defs.levelFields[${problem.fieldId}]`
    found.push(diagnostic('error', 'fieldDefInvalid', path, problem.message))
  }
  return found
}

function ruleChecks(project: Project): Diagnostic[] {
  const found: Diagnostic[] = []
  for (const layer of project.defs.layers) {
    if (layer.kind !== 'auto') continue
    const source = project.defs.layers.find((candidate) => candidate.id === layer.source)
    if (source?.kind !== 'intgrid') continue
    const tileset = project.defs.tilesets.find((set) => set.id === layer.tileset)
    const issues = ruleIssues(layer.groups, {
      values: new Set(source.values.map((value) => value.value)),
      tileCount: tileset === undefined ? undefined : tilesetTiles(tileset).count,
    })
    for (const issue of issues) {
      found.push(
        diagnostic(
          issue.severity,
          RULE_CODES[issue.code],
          `defs.layers[${layer.id}].groups[${issue.group}].rules[${issue.rule}]`,
          issue.message,
        ),
      )
    }
  }
  return found
}

function unusedChecks(project: Project): Diagnostic[] {
  const found: Diagnostic[] = []
  const drawnWith = new Set<string>()
  for (const layer of project.defs.layers) if ('tileset' in layer) drawnWith.add(layer.tileset)
  for (const def of project.defs.entities) if (def.tile) drawnWith.add(def.tile.tileset)
  for (const set of project.defs.tilesets) {
    if (!drawnWith.has(set.id)) {
      found.push(
        diagnostic(
          'info',
          'unusedDefinition',
          `defs.tilesets[${set.id}]`,
          `Tileset "${set.label}" is not used by any layer.`,
        ),
      )
    }
  }
  const placed = new Set<string>()
  for (const level of project.levels) {
    for (const layer of level.layers)
      if (layer.kind === 'entities') for (const item of layer.items) placed.add(item.def)
  }
  for (const def of project.defs.entities) {
    if (!placed.has(def.id)) {
      found.push(
        diagnostic(
          'info',
          'unusedDefinition',
          `defs.entities[${def.id}]`,
          `Nothing in any level is a "${def.label ?? def.id}".`,
        ),
      )
    }
  }
  return found
}

export function definitionChecks(project: Project, context: ProjectContext): Diagnostic[] {
  return [
    ...tilesetChecks(project, context),
    ...fieldDefChecks(project),
    ...ruleChecks(project),
    ...unusedChecks(project),
  ]
}
