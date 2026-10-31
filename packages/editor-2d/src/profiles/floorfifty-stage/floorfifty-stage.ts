import type { ExportTarget, Profile, ProjectContext, ViewDef } from '../profile'
import { NEW_STAGE_TEXT } from './new-stage'
import type { StageCheckContext } from './stage-checks'
import { checkStage } from './stage-checks'
import { parseStage, printStage } from './stage-codec'
import type { StageDocument } from './stage-document'
import { applyStageFix } from './stage-fixes'
import { emptyTemplate, simpleCityTemplate, skyOnlyTemplate } from './templates/stage-templates'

// The FloorFifty profile (2D editor spec §10): the game's own stage TOML as an editable document. It plugs the codec,
// the checks, the repairs, the three templates, the rail and the export into the editor; the commands that change a
// document (`commands/`) are what the views call. It registers in `app/profiles.ts`, the one file allowed to import it.

/** A stage's root key; it comes before any table, so a file the parser chokes on later still shows it. */
const STAGE_KEY = /^platformAlias\s*=/m
/** `[theme]`, `[[theme.layers]]`: a file named `.toml` that opens with a theme table is a stage whose root keys are damaged. */
const THEME_TABLE = /^\[{1,2}theme[\].]/m

/** `base` is empty for a document that was never loaded, which prints against the text of a new stage. */
const printAgainst = (base: string, document: StageDocument): string =>
  printStage(base === '' ? NEW_STAGE_TEXT : base, document)

/**
 * The checks' context from the project's. `assets` is the art manifest's aliases for this profile (an alias is an asset's
 * name in the game's manifest); without it the checks say aliases are unchecked. The tunable declarations, `tuning.toml`
 * and the tallest course are the checks' bundled ones until the app can read the game's folder.
 */
function checkContext(context: ProjectContext): StageCheckContext {
  return { aliases: context.assets === undefined ? undefined : new Set(context.assets) }
}

const views: readonly ViewDef[] = [
  // "Scene": "Compose" does not fit the 56 px rail (plan EDFF.2a-1 decision 5).
  { id: 'compose', label: 'Scene', component: 'ComposeView' },
  { id: 'course', label: 'Course', component: 'CourseView' },
  { id: 'pieces', label: 'Pieces', component: 'PiecesView' },
  { id: 'stage', label: 'Stage', component: 'StageView' },
  { id: 'assets', label: 'Assets', component: 'AssetsView' },
  { id: 'checks', label: 'Checks', component: 'ChecksView' },
  { id: 'export', label: 'Export', component: 'ExportView' },
]

const exports: readonly ExportTarget<StageDocument>[] = [
  {
    id: 'stage-toml',
    label: 'Stage file (TOML)',
    files: (document, base) => [
      { path: `content/stages/${document.value.id}.toml`, contents: printAgainst(base, document) },
    ],
  },
]

export const floorFiftyStage: Profile<StageDocument> = {
  id: 'floorfifty-stage',
  label: 'FloorFifty stage',
  sniff: (fileName, text) =>
    STAGE_KEY.test(text) || (fileName.toLowerCase().endsWith('.toml') && THEME_TABLE.test(text)),
  parse: parseStage,
  print: printAgainst,
  check: (document, context) => checkStage(document, checkContext(context)),
  // No repair reads an alias, so the project's context is not passed on; `fit-phrases` reads the bundled tuning until the app can supply `tuning.toml`.
  fix: (document, diagnostic) => applyStageFix(document, diagnostic),
  templates: [emptyTemplate, skyOnlyTemplate, simpleCityTemplate],
  views,
  exports,
}
