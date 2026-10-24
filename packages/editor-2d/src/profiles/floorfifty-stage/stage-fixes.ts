import type { Diagnostic } from '../profile'
import { resolveContext, type StageCheckContext } from './check-types'
import { fitPhrasesToCourse } from './commands/course-edits'
import { sortLayersByDepth } from './commands/layer-edits'
import { setSetPieceField } from './commands/piece-edits'
import type { StageDocument } from './stage-document'
import { courseTopFloor } from './tunables'

// The one-step repairs the checks name (2D editor spec §10.6 and §10.7, EDFF.1d). A finding's `fix` is the name of a
// repair; `applyStageFix` turns it into the commands that make it, so the app needs to know no profile's names.

/** Where the finding sits in a piece's list of layer names: `theme.setPieces[b3].layers[1]`. */
const NAME_PATH = /^theme\.setPieces\[([^\]]+)\]\.layers\[(\d+)\]$/

function removeName(document: StageDocument, path: string): StageDocument {
  const found = NAME_PATH.exec(path)
  if (found === null) throw new RangeError(`cannot read "${path}" as a name in a set piece's layers`)
  const index = document.ids.setPieces.indexOf(found[1] as string)
  const piece = document.value.theme.setPieces[index]
  if (piece === undefined || (piece.kind !== 'swarm' && piece.kind !== 'weatherBurst'))
    throw new RangeError(`the set piece "${found[1]}" is no longer there`)
  const position = Number(found[2])
  const names = piece.layers ?? []
  if (position >= names.length) throw new RangeError(`the piece has no layer name ${position}`)
  const remaining = names.filter((_, at) => at !== position)
  // A burst that names no layer plays on every layer; a swarm without a layer is an error of its own (`setPieceRange`).
  return setSetPieceField(
    document,
    index,
    'layers',
    remaining.length === 0 && piece.kind === 'weatherBurst' ? undefined : remaining,
  )
}

function fitPhrases(document: StageDocument, context: StageCheckContext): StageDocument {
  const { tunables, baseTuning } = resolveContext(context)
  const top = courseTopFloor(tunables, baseTuning, document.value.courseTuning)
  if (top === undefined)
    throw new RangeError('the course length (COURSE_FLOOR_COUNT) is out of range; fix that first')
  return fitPhrasesToCourse(document, top)
}

/**
 * Applies the repair `diagnostic.fix` names and returns the next document. A finding with no repair, a repair the
 * profile does not know, or one whose target is gone is a programmer error: the app offers a repair only for a finding
 * of the document it was found in.
 */
export function applyStageFix(
  document: StageDocument,
  diagnostic: Diagnostic,
  context: StageCheckContext = {},
): StageDocument {
  switch (diagnostic.fix) {
    case undefined:
      throw new RangeError(`the finding ${diagnostic.code} has no repair`)
    case 'reorder-layers':
      return sortLayersByDepth(document)
    case 'fit-phrases':
      return fitPhrases(document, context)
    case 'remove-name':
      return removeName(document, diagnostic.path)
    default:
      throw new RangeError(`this profile has no repair called "${diagnostic.fix}"`)
  }
}
