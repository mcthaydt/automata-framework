import type { StageTheme, StageValue } from '../stage.schema'
import type { StageDocument } from '../stage-document'
import { withKey, withTheme, withValue } from './edit-helpers'

// The stage's name, its aliases and its tuning (2D editor spec §10.6, EDFF.1d). Aliases name art in the game's manifest;
// whether one is there is a finding of the checks, never a refusal here.

const setValueKey = <K extends keyof StageValue>(
  document: StageDocument,
  key: K,
  value: StageValue[K],
): StageDocument => withValue(document, withKey(document.value, key, value))

const setThemeKey = <K extends keyof StageTheme>(
  document: StageDocument,
  key: K,
  value: StageTheme[K],
): StageDocument => withTheme(document, withKey(document.value.theme, key, value))

export const renameStage = (document: StageDocument, displayName: string): StageDocument =>
  setValueKey(document, 'displayName', displayName)

export const setStageId = (document: StageDocument, id: string): StageDocument =>
  setValueKey(document, 'id', id)

/** The condition in `unlocks.toml` that opens the stage; `undefined` leaves the stage open. */
export const setUnlock = (document: StageDocument, unlock: string | undefined): StageDocument =>
  setValueKey(document, 'unlock', unlock)

export const setPlatformAlias = (document: StageDocument, alias: string): StageDocument =>
  setValueKey(document, 'platformAlias', alias)

export const setBackdropAlias = (document: StageDocument, alias: string): StageDocument =>
  setThemeKey(document, 'backdropAlias', alias)

/** The sun or the moon; `undefined` draws none. Its height is `setPresentation(…, 'lightHeight', …)`. */
export const setLight = (document: StageDocument, alias: string | undefined): StageDocument =>
  setThemeKey(document, 'lightAlias', alias)

export const setPreviewAlias = (document: StageDocument, alias: string | undefined): StageDocument =>
  setThemeKey(document, 'previewAlias', alias)

export const setAmbienceAlias = (document: StageDocument, alias: string | undefined): StageDocument =>
  setThemeKey(document, 'ambienceAlias', alias)

/** The stage's override of a tunable; `undefined` falls back to `tuning.toml`. Which names exist is the checks' business. */
export function setCourseTuning(
  document: StageDocument,
  name: string,
  value: number | undefined,
): StageDocument {
  // `Record<string, number | undefined>` only so that `withKey` may drop the key; no value is ever undefined in the result.
  const tuning = withKey<Record<string, number | undefined>, string>(document.value.courseTuning, name, value)
  return withValue(
    document,
    withKey(document.value, 'courseTuning', tuning as Readonly<Record<string, number>>),
  )
}
