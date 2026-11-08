// The ready-made behaviours a person starts a character from. Each is plain data written with today's
// conditions and actions only: nothing here is a mode of its own in the sim. The sim tests run these same
// definitions (`extensions/systems/tests/unit/presets-sim.test.ts` reads the fixture that `presets.test.ts` keeps equal).
import type { AgentDef, RoutineStop, Transition } from '@automata/systems/sim'

export type PresetKind = 'guard' | 'sentry' | 'hunter' | 'coward' | 'wanderer'

export interface Preset {
  readonly kind: PresetKind
  readonly title: string
  /** One line a person reads before choosing. */
  readonly words: string
}

export const PRESETS: readonly Preset[] = [
  {
    kind: 'guard',
    title: 'Guard',
    words:
      'Walks a patrol, chases the player when it sees her, searches where it lost her, and catches her on touch.',
  },
  {
    kind: 'sentry',
    title: 'Sentry',
    words: 'Stands at its post. When it sees the player it sounds the alarm.',
  },
  {
    kind: 'hunter',
    title: 'Hunter',
    words:
      'Walks a patrol, goes to any noise it hears, gives up after a few seconds, and catches the player on touch.',
  },
  {
    kind: 'coward',
    title: 'Coward',
    words: 'Walks a patrol and runs away from the player when it sees her.',
  },
  {
    kind: 'wanderer',
    title: 'Wanderer',
    words: 'Visits its stops in order and ignores the player.',
  },
]

const caught = { emit: { caught: 'player' } } as const
const seesIt = { sees: true } as const
const resetWait = { set: 'self.timer', to: 0 } as const
const arrivedThenStill = (seconds: number) => [{ fact: 'self.idle', is: true }, { timer: seconds }] as const

/** A catch on touch from any mode the character moves in. */
const catchOnTouch: Transition = {
  from: '*',
  to: 'catch',
  priority: 90,
  when: [{ touching: true }],
  do: [caught],
}

/** Stops for a preset: the scene's first places, up to `count`, waiting `dwell` seconds each. */
const stopsAt = (places: readonly string[], count: number, dwell: number): RoutineStop[] =>
  places.slice(0, count).map((node) => ({ node, dwell }))

const withRoutine = (agent: Omit<AgentDef, 'routine'>, stops: RoutineStop[]): AgentDef =>
  stops.length === 0 ? agent : { ...agent, routine: stops }

/** A character of this kind named `id`, patrolling the first of `places`. */
export function presetAgent(kind: PresetKind, id: string, places: readonly string[]): AgentDef {
  switch (kind) {
    case 'guard':
      return withRoutine(
        {
          id,
          modes: ['patrol', 'hunt', 'search', 'catch'],
          initial: 'patrol',
          speed: { patrol: 1.4, hunt: 2.2, search: 1.4, catch: 0 },
          senses: [{ sight: { range: 6 } }, { sound: { reach: 8 } }, { touch: { radius: 0.6 } }],
          transitions: [
            { from: 'patrol', to: 'hunt', priority: 30, when: [seesIt] },
            { from: 'hunt', to: 'hunt', priority: 20, when: [seesIt], do: [{ goTo: 'player' }] },
            { from: 'hunt', to: 'search', priority: 10, when: [{ not: seesIt }], do: [resetWait] },
            { from: 'search', to: 'hunt', priority: 30, when: [seesIt] },
            { from: 'search', to: 'patrol', priority: 10, when: [...arrivedThenStill(5)] },
            catchOnTouch,
          ],
        },
        stopsAt(places, 3, 2),
      )
    case 'sentry':
      return withRoutine(
        {
          id,
          modes: ['patrol', 'alarm'],
          initial: 'patrol',
          speed: { patrol: 0, alarm: 0 },
          senses: [{ sight: { range: 8 } }],
          transitions: [
            {
              from: 'patrol',
              to: 'alarm',
              priority: 20,
              when: [seesIt],
              do: [{ noise: { at: 'self', loudness: 15, kind: 'alarm' } }, { set: 'alarm', to: true }],
            },
            { from: 'alarm', to: 'patrol', priority: 10, when: [{ not: seesIt }] },
          ],
        },
        stopsAt(places, 1, 1),
      )
    case 'hunter':
      return withRoutine(
        {
          id,
          modes: ['patrol', 'listen', 'catch'],
          initial: 'patrol',
          speed: { patrol: 1.2, listen: 1.8, catch: 0 },
          senses: [{ sound: { reach: 12 } }, { touch: { radius: 0.6 } }],
          transitions: [
            {
              from: 'patrol',
              to: 'listen',
              priority: 20,
              when: [{ heard: '*' }],
              do: [resetWait, { goTo: 'noise' }],
            },
            { from: 'listen', to: 'patrol', priority: 10, when: [...arrivedThenStill(4)] },
            catchOnTouch,
          ],
        },
        stopsAt(places, 3, 2),
      )
    case 'coward':
      return withRoutine(
        {
          id,
          modes: ['patrol', 'flee'],
          initial: 'patrol',
          speed: { patrol: 1.2, flee: 2.4 },
          senses: [{ sight: { range: 6 } }],
          transitions: [
            { from: 'patrol', to: 'flee', priority: 20, when: [seesIt], do: [resetWait, { flee: 'player' }] },
            { from: 'flee', to: 'patrol', priority: 10, when: [{ not: seesIt }, { timer: 3 }] },
          ],
        },
        stopsAt(places, 3, 2),
      )
    case 'wanderer':
      return withRoutine(
        {
          id,
          modes: ['patrol'],
          initial: 'patrol',
          speed: { patrol: 1 },
          senses: [],
          transitions: [],
        },
        stopsAt(places, 3, 2),
      )
  }
}
