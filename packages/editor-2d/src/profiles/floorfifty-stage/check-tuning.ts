import type { Diagnostic } from '../profile'
import { problem, type ResolvedCheckContext } from './check-types'
import type { StageDocument } from './stage-document'
import { suggestNames } from './suggest'
import { AUTHORING_INVARIANTS, tunableFault } from './tunables'

// A stage's `courseTuning` against the tunable declarations (FloorFifty `validate/bounds.ts`). Every override is judged on
// its own, so one save reports every bad number.

export function checkTuning(document: StageDocument, context: ResolvedCheckContext): Diagnostic[] {
  const names = Object.keys(context.tunables)
  return Object.entries(document.value.courseTuning).flatMap(([name, value]): Diagnostic[] => {
    const path = `courseTuning.${name}`
    // An invariant is answered before an unknown name, so `TICK_HZ` is not taken for a typo.
    if (AUTHORING_INVARIANTS.includes(name))
      return [problem('codeOnlyTunable', path, `${name} is fixed in the game’s code; a stage cannot set it.`)]
    const declaration = context.tunables[name]
    if (declaration === undefined) {
      const guesses = suggestNames(name, names, 1)
      const advice = guesses.length === 0 ? '' : ` Did you mean "${guesses[0]}"?`
      return [problem('unknownTunable', path, `"${name}" is not a tunable.${advice}`)]
    }
    const fault = tunableFault(name, value, declaration)
    return fault === undefined ? [] : [problem('tunableRange', path, fault)]
  })
}
