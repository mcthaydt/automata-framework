// What a world rule may be given. The game's checks refuse a rule that asks a character something only a character
// can answer (does it see the player? has it got where it was going?) or that moves one without saying which. So each
// menu offers exactly the pieces whose new value passes those checks, asked of the checks themselves, never a list kept
// here that could drift from them.
import { checkSystems, type Probe, type SysEffect, type SystemsDef } from '@automata/systems/sim'
import { ACTIONS } from './pieces/actions.ts'
import { CONDITIONS } from './pieces/conditions.ts'
import type { Names, Piece } from './pieces/piece.ts'

/** A piece whose new value names a character where the kind takes one, because a rule has no character of its own. */
function forRules<V>(piece: Piece<V>, def: SystemsDef): Piece<V> {
  const first = def.agents[0]
  return {
    ...piece,
    fresh(names) {
      const value = piece.fresh({ ...names, modes: first?.modes ?? names.modes })
      const asks = (value as object) && ('mode' in (value as object) || 'setMode' in (value as object))
      return first !== undefined && asks && (value as { agent?: string }).agent === undefined
        ? { ...value, agent: first.id }
        : value
    },
  }
}

/** Whether the game's checks find a fault in a rule made of just this. */
function faulty(def: SystemsDef, part: { when?: Probe[]; then?: SysEffect[] }): boolean {
  let found = false
  checkSystems(
    { ...def, rules: [{ id: 'probe', text: 'probe', when: part.when ?? [], then: part.then ?? [] }] },
    { hooks: [] },
    (path) => {
      if (path[0] === 'rules') found = true
    },
  )
  return found
}

export function ruleConditions(def: SystemsDef, names: Names): Piece<Probe>[] {
  return CONDITIONS.map((piece) => forRules(piece, def)).filter(
    (piece) => !faulty(def, { when: [piece.fresh(names)] }),
  )
}

export function ruleActions(def: SystemsDef, names: Names): Piece<SysEffect>[] {
  return ACTIONS.map((piece) => forRules(piece, def)).filter(
    (piece) => !faulty(def, { then: [piece.fresh(names)] }),
  )
}
