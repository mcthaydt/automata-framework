import type { PhraseName, StageCitySink, StagePresentation } from '../stage.schema'
import type { StageDocument } from '../stage-document'
import { withKey, withTheme } from './edit-helpers'

// The stage's presentation block and the city's ascent arc (2D editor spec §10.6, EDFF.1d). The block is optional and
// so is its arc, so an edit that needs one that is not there makes it, from values that change nothing on screen.

/** The only profile the game knows; the other two fields at 0 are no refraction and no horizon lift. */
const NEUTRAL: StagePresentation = { profile: 'aquarian', refractionIntensity: 0, horizonLift: 0 }
const FLAT_ARC: StageCitySink = { teach: 0, combine: 0, recover: 0, finish: 0 }

/** The fields of the block that a person sets one at a time (`profile` has one value; the arc has its own commands). */
export type PresentationField =
  | 'refractionIntensity'
  | 'horizonLift'
  | 'lightHeight'
  | 'lightShimmer'
  | 'silhouette'

function withPresentation(
  document: StageDocument,
  presentation: StagePresentation | undefined,
): StageDocument {
  return withTheme(document, withKey(document.value.theme, 'presentation', presentation))
}

export function setPresentation<K extends PresentationField>(
  document: StageDocument,
  field: K,
  value: StagePresentation[K],
): StageDocument {
  const current = document.value.theme.presentation
  // Unsetting a field of a block that is not there is nothing to do, and creates nothing.
  if (current === undefined && value === undefined) return document
  return withPresentation(document, withKey(current ?? { ...NEUTRAL }, field, value))
}

export function removePresentation(document: StageDocument): StageDocument {
  return withPresentation(document, undefined)
}

/** How far the city has sunk by the end of `phrase`, in logical units; the other three phrases keep their values. */
export function setCitySink(document: StageDocument, phrase: PhraseName, value: number): StageDocument {
  const current = document.value.theme.presentation
  const block = current ?? { ...NEUTRAL }
  return withPresentation(
    document,
    withKey(block, 'citySink', withKey(block.citySink ?? { ...FLAT_ARC }, phrase, value)),
  )
}

export function removeCitySink(document: StageDocument): StageDocument {
  const current = document.value.theme.presentation
  if (current === undefined) return document
  return withPresentation(document, withKey(current, 'citySink', undefined))
}
