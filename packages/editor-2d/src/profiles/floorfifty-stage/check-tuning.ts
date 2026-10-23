import type { Diagnostic } from '../profile'
import { problem, type ResolvedCheckContext } from './check-types'
import type { StageDocument } from './stage-document'
import { suggestNames } from './suggest'
import { AUTHORING_INVARIANTS } from './tunables'

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
    if (Number.isNaN(value)) return [problem('tunableRange', path, `${name} is not a number.`)]
    const whole = declaration.type === 'int'
    if (value >= declaration.min && value <= declaration.max && (!whole || Number.isInteger(value))) return []
    return [
      problem(
        'tunableRange',
        path,
        `${name} is ${value}; it must be ${whole ? 'a whole number ' : ''}from ${declaration.min} to ${declaration.max}.`,
      ),
    ]
  })
}
