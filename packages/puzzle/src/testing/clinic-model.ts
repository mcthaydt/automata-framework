// The adventure source's clinic solver model, ported by hand (its calls are TypeScript, PZ-D6; provenance in the
// framework's docs/provenance/sources.md). What the clinic's `{ call }` effects do to the solver's abstract state:
// - `water`: how much puddle touches the fuse box (2 full, 1 one scoop short of dry, 0 dry). Shutting the valve drains
//   it; the cloth mops it at once; an empty basin scoops one level, which keeps only once the valve is shut. While the
//   valve is open, a mopped puddle refills as soon as the player walks elsewhere (`mopped`).
// - `knowsCode`: the player has seen 04:17 (the monitor, the clock, the record, the scratches). The right code needs it.
// - A lit curtain burns for one step (long enough to douse it), then both are ash.
// - The breaker: with a dry box it powers the exit; with a wet one it shorts.
// The route-test part of the source's model (`routes`) is M6.6c's.
import type { PuzzleModel, State, Step } from '../solver/index'

type Facts = Record<string, string | number | boolean>
const set = (s: State, facts: Facts): State => ({ ...s, facts: { ...s.facts, ...facts } })
const without = (s: State, item: string): State => {
  const items = [...s.items]
  const i = items.indexOf(item)
  if (i >= 0) items.splice(i, 1)
  return { ...s, items }
}
const learn = { set: 'knowsCode', to: true } as const
/** Walking anywhere but the puddle and the fuse box (within reach of each other) gives the leak time. */
const away = (step: Step): boolean =>
  step.systemic !== true &&
  step.at !== 'puddle' &&
  step.at !== 'fuseBox' &&
  step.at !== 'combine' &&
  step.at !== 'floor'
/** A burning curtain lasts only the step that lit it: after any other step it is ash. */
const lit = (step: Step): boolean => /^curtain(West|East)\.(light|torch)$/.test(step.action)
const burnOut = (s: State, step: Step): State =>
  lit(step)
    ? s
    : set(
        s,
        Object.fromEntries(
          ['curtainWest', 'curtainEast'].filter((c) => s.facts[c] === 'burning').map((c) => [c, 'ash']),
        ),
      )

export const CLINIC_MODEL: PuzzleModel = {
  facts: { water: 2, knowsCode: false, mopped: false },
  available: (s, at) =>
    at === 'scratches'
      ? s.facts.curtainWest === 'ash' || s.facts.curtainWest === 'cut'
      : at === 'shelf' || at === 'valve'
        ? s.facts.closetOpen === true
        : true,
  effects: {
    'monitor.read': [learn],
    'clock.read': [learn],
    'record.read': [learn],
    'scratches.read': [learn],
    'valve.shut': [{ set: 'water', to: 0 }],
  },
  require: { 'code.right': [{ fact: 'knowsCode', is: true }] },
  after: (s, step) =>
    burnOut(
      s.facts.mopped === true && (s.facts.valveShut === true || away(step))
        ? set(s, { mopped: false, water: s.facts.valveShut === true ? (s.facts.water as number) : 2 })
        : s,
      step,
    ),
  calls: {
    read: (s) => [s],
    ignite: (s) => [
      set(s, { curtainWest: 'ash', curtainEast: 'ash' }),
      set(s, { curtainWest: 'burning', curtainEast: 'burning' }),
    ],
    pourPuddle: (s) => [set(s, { basinFull: false, water: 2 })],
    pourFuseBox: (s) => [set(s, { basinFull: false, water: 2 })],
    pourFloor: (s) => [set(s, { basinFull: false })],
    throwBreaker: (s) => [Number(s.facts.water) > 0 ? s : set(s, { power: true })],
    lookFuseBox: (s) => [s],
    // The bolt is a systemic set-up (the Nurse waits at it), not a lock: it changes nothing the solver tracks.
    bolt: (s) => [s],
    puddle: (s, step) =>
      step.held === 'cloth'
        ? [set(without(s, 'cloth'), { water: 0, mopped: s.facts.valveShut !== true })]
        : step.held === 'basin' && s.facts.basinFull !== true
          ? [
              set(s, {
                basinFull: true,
                water:
                  s.facts.valveShut === true
                    ? Math.max(0, Number(s.facts.water) - 1)
                    : (s.facts.water as number),
              }),
            ]
          : [s],
    throwBottle: (s) => [without(s, 'bottle')],
    tools: (s, step) => {
      const [a, b] = step.pair ?? ['', '']
      const pair = (x: string, y: string) => (a === x && b === y) || (a === y && b === x)
      if (pair('lighter', 'cloth'))
        return Number(s.facts.fuel) > 0
          ? [{ ...without(s, 'cloth'), items: [...without(s, 'cloth').items, 'torch'] }]
          : [s]
      if (pair('lighter', 'fluid'))
        return [set(without(s, 'fluid'), { fuel: Math.min(80, Number(s.facts.fuel) + 40) })]
      return [s]
    },
  },
}
