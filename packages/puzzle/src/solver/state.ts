// The solver's state and its plain effects. A verb's conditions are read with puzzle's own `holds`, through a reader
// over this state, so `held` and `code` are the verb's virtual facts exactly as in the interpreter (PZ-D1).
import { type Cond, holds as condHolds, type Effect, type Reader } from '../sim/index'
import type { State } from './model'

export const clone = (s: State): State => ({ facts: { ...s.facts }, items: [...s.items], seen: [...s.seen] })

export const readerOf = (s: State): Reader => ({
  fact: (name) => s.facts[name],
  has: (item) => s.items.includes(item),
})

export const holds = (s: State, c: Cond, held = '', code = ''): boolean =>
  condHolds(
    readerOf(s),
    { at: '', held: held === '' ? undefined : held, code: code === '' ? undefined : code },
    c,
  )

/** Applies plain effects (set, add, give, take); everything else is presentation or handled by the model. */
export function applyEffect(s: State, e: Effect): void {
  if ('set' in e) s.facts[e.set] = e.to
  else if ('add' in e) s.facts[e.add] = Number(s.facts[e.add] ?? 0) + e.by
  else if ('give' in e) s.items.push(e.give)
  else if ('take' in e) {
    const i = s.items.indexOf(e.take)
    if (i >= 0) s.items.splice(i, 1)
  }
}
