import { openProject } from '../../model/open-project'
import { printProject } from '../../model/project-codec'
import type { Project } from '../../model/project-types'
import type { ExportTarget, ParseError, Profile, Result, ViewDef } from '../profile'
import { exportContent } from './content-export'
import { checkProject } from './project-checks'
import { applyProjectFix, chooseTarget, refChoices } from './project-fixes'
import { summarizeProject } from './project-summary'
import { blankTemplate } from './templates/blank'
import { platformerTemplate } from './templates/platformer'
import { topdownRpgTemplate } from './templates/topdown-rpg'

// The built-in profile (2D editor spec §7): the genre-general level project of §5, opened from `*.af2d.json`. It
// plugs the model, its checks, its three templates and its two exports into the editor; it holds no logic of its own.

/** How much of a file `sniff` reads: the format key sits at the top of a canonical file. */
const SNIFF_CHARS = 4096

function parse(text: string): Result<Project, readonly ParseError[]> {
  const opened = openProject(text)
  switch (opened.status) {
    case 'opened':
      return { ok: true, value: opened.project }
    case 'readOnly':
      // The profile opens a document it can write back; a read-only one is the app's text view, which has the text.
      return {
        ok: false,
        error:
          opened.reason === 'unknownKeys'
            ? (opened.keyPaths ?? []).map((path) => ({
                code: 'unknownKeys',
                message: `"${path}" is not a key this editor knows.`,
                path,
              }))
            : [{ code: 'newerVersion', message: opened.message }],
      }
    case 'failed':
      return {
        ok: false,
        error:
          opened.issues === undefined
            ? [{ code: opened.code, message: opened.message, line: opened.line, column: opened.column }]
            : opened.issues.map((issue) => ({ code: issue.code, message: issue.message, path: issue.path })),
      }
  }
}

/** `Moss Gate: Part 1!` becomes `moss-gate-part-1`; a name with no letter or digit becomes `project`. */
function fileStem(name: string): string {
  const stem = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return stem === '' ? 'project' : stem
}

const views: ViewDef[] = [
  { id: 'level', label: 'Level', component: 'LevelView' },
  { id: 'world', label: 'World', component: 'WorldView' },
  { id: 'tilesets', label: 'Tilesets', component: 'TilesetsView' },
  { id: 'entities', label: 'Entities', component: 'EntitiesView' },
  { id: 'checks', label: 'Checks', component: 'ChecksView' },
  { id: 'export', label: 'Export', component: 'ExportView' },
]

const exports: ExportTarget<Project>[] = [
  {
    id: 'af2d-json',
    label: 'Project file',
    files: (project) => [{ path: `${fileStem(project.name)}.af2d.json`, contents: printProject(project) }],
  },
  { id: 'af-content', label: 'Game files', files: exportContent },
]

export const levelProject: Profile<Project> = {
  id: 'level-project',
  label: 'Level project',
  sniff: (fileName, text) =>
    fileName.toLowerCase().endsWith('.af2d.json') || /"format"\s*:\s*"af2d"/.test(text.slice(0, SNIFF_CHARS)),
  parse,
  // The canonical printer owns the whole text, so the text as loaded (`base`) is not needed.
  print: (_base, project) => printProject(project),
  check: checkProject,
  fix: (project, diagnostic) => applyProjectFix(project, diagnostic),
  choices: (project, diagnostic) => refChoices(project, diagnostic),
  choose: (project, diagnostic, choice) => chooseTarget(project, diagnostic, choice.value),
  summary: summarizeProject,
  // The first level is the one a template starts on, so a new project's card shows what its Level view opens on.
  preview: (project) => {
    const [first] = project.levels
    return first === undefined ? undefined : { project, level: first.id }
  },
  templates: [platformerTemplate, topdownRpgTemplate, blankTemplate],
  views,
  exports,
}
