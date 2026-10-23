import type { Diagnostic } from '../profile'
import { checkCourse } from './check-course'
import { checkEditorRules } from './check-editor'
import { checkLayers } from './check-layers'
import { checkReferences } from './check-references'
import { checkSchema } from './check-schema'
import { checkSetPieces } from './check-set-pieces'
import { checkTuning } from './check-tuning'
import { resolveContext, type StageCheckContext, sortBySeverity } from './check-types'
import type { StageDocument } from './stage-document'

export type { StageCheckContext } from './check-types'

// The checks of a FloorFifty stage (2D editor spec §10.7, EDFF.1b). They read the document's value, not the schema's
// verdict: a command can leave a value the schema would refuse, and the editor keeps that document open, says what is
// wrong and where, and offers the repair.

/** Everything wrong or suspicious in the stage: errors, then warnings, then info. */
export function checkStage(document: StageDocument, context: StageCheckContext = {}): readonly Diagnostic[] {
  const resolved = resolveContext(context)
  return sortBySeverity([
    ...checkSchema(document),
    ...checkLayers(document),
    ...checkSetPieces(document),
    ...checkCourse(document, resolved),
    ...checkReferences(document, resolved),
    ...checkTuning(document, resolved),
    ...checkEditorRules(document),
  ])
}
