// inputs(): several `keys()` maps as one input map (M3.7b part 3a). A game whose sim takes its input as separate
// commands (a move, a lock, the action buttons) sends each map's command every tick, from one Input over the merged
// bindings: one poll, one set of touch buttons, one Controls section.
import {
  type InputProfile,
  inputProfileSchema,
  makeInput,
  type PresentationBus,
  type TouchMode,
  touchModesFor,
} from '@mcthaydt/automata-runtime'
import type { Command } from '@mcthaydt/automata-sim'
import { Effect, Exit, Scope } from 'effect'
import type { InputMap } from './keys.ts'

/** `attach` builds an Input of its own; nothing reads its facts. */
const SILENT_BUS: PresentationBus = { publish: () => {}, subscribe: () => () => {} }

/**
 * Each action id, key and pad button belongs to one map only: a shared action id would merge one map's binding
 * over the other's and lose it, and a shared key would send two commands for one press.
 */
function checkShared(maps: readonly InputMap[]): void {
  const actionOwner = new Map<string, string>()
  for (const map of maps)
    for (const action of Object.keys(map.profile.bindings)) {
      const first = actionOwner.get(action)
      if (first !== undefined)
        throw new Error(
          `inputs(): the action "${action}" is defined by both "${first}" and "${map.command.id}"`,
        )
      actionOwner.set(action, map.command.id)
    }
  const owner = new Map<string, string>()
  for (const map of maps)
    for (const binding of Object.values(map.profile.bindings)) {
      const inputs = [...binding.keys, ...binding.pad.map((button) => `pad button ${button}`)]
      for (const input of inputs) {
        const first = owner.get(input)
        if (first !== undefined && first !== map.command.id)
          throw new Error(`inputs(): ${input} is bound by both "${first}" and "${map.command.id}"`)
        owner.set(input, map.command.id)
      }
    }
}

/**
 * One input map from `maps`, each sending its own command every tick in map order. The commands share source 0, so
 * each gets its own `seq`: `tick × maps.length + index` (a u32, which at 60 Hz lasts 2³²/60/86,400/n ≈ 828/n days of
 * play). `command` is the first map's. Throws on no maps, on two maps for one command, and on an action id, a key or
 * a pad button two maps share.
 */
export function inputs(...maps: readonly InputMap[]): InputMap {
  const first = maps[0]
  if (first === undefined) throw new Error('inputs(): needs at least one map')
  const ids = maps.map((map) => map.command.id)
  for (const [index, id] of ids.entries())
    if (ids.indexOf(id) !== index) throw new Error(`inputs(): the command "${id}" is mapped twice`)
  checkShared(maps)

  const profile: InputProfile = inputProfileSchema.parse({
    id: ids.join('+'),
    bindings: Object.assign({}, ...maps.map((map) => map.profile.bindings)),
  })
  const modes = touchModesFor(profile)
  const touchMode: TouchMode = maps.every((map) => map.touchMode === 'swipe') ? 'swipe' : 'buttons'
  if (!modes.includes(touchMode)) throw new Error(`inputs(): touchMode "${touchMode}" has nothing to touch`)

  const toCommand = (held: Iterable<string>, tick: number): readonly Command[] => {
    const actions = [...held]
    const commands: Command[] = []
    for (const [index, map] of maps.entries())
      for (const command of map.toCommand(actions, tick))
        commands.push({ ...command, seq: tick * maps.length + index })
    return commands
  }

  return {
    command: first.command,
    touch: maps.some((map) => map.touch),
    touchButtons: maps.flatMap((map) => (map.touch ? map.touchButtons : [])),
    touchMode,
    profile,
    labels: Object.assign({}, ...maps.map((map) => map.labels)),
    toCommand,
    attach(target) {
      // One Input over the merged bindings, in a scope of its own that `dispose` closes, as `keys()` attaches.
      const scope = Effect.runSync(Scope.make())
      const input = Effect.runSync(makeInput({ target, profile, bus: SILENT_BUS }).pipe(Scope.extend(scope)))
      return {
        commands(tick) {
          input.poll()
          return toCommand(input.held(), tick)
        },
        hold: (buttonId) => input.hold(buttonId),
        release: (buttonId) => input.release(buttonId),
        gesture: input.gesture,
        dispose: () => Effect.runSync(Scope.close(scope, Exit.void)),
      }
    },
  }
}
