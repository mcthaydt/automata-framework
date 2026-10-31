// The lock's inputs (GAME-3D.1b part 2, DESIGN.md §11.2, §12.2): the player's saved Lock mode in every `lock`
// command, and `lock-cycle` from the camera-turn keys, a camera drag and a right-stick flick. It also carries the one
// queued `equip` (GAME-3D.1e part 5b, §14.1): the Items screen and the 1, 2 and 3 keys ask for an item, and the next
// tick sends it. `equip` has no idle payload, so it cannot be a `keys()` command sent every tick.
//
// The cycle inputs are the camera's: the sim ignores `camera-turn` while locked (`rotate` is off) and `lock-cycle`
// while not, so a Q press sends both and nothing here needs to know whether Wick is locked. `lock-cycle` is one
// tick's event, not a held state, so this finds a cycle key's first tick itself: the input layer's one edge.
import type { InputMap } from '@mcthaydt/automata-game'
import { makeInput, type PresentationBus } from '@mcthaydt/automata-runtime'
import type { Command } from '@mcthaydt/automata-sim'
import type { DragTracker } from '@mcthaydt/automata-ui'
import { Effect, Exit, Scope } from 'effect'
import { Equip, Lock, LockCycle } from '../commands.ts'
import type { ItemName } from './hud.ts'
import type { LockMode } from './settings.ts'

/** 1 clockwise seen from above, −1 anticlockwise (`lock-cycle`). */
export type CycleDir = 1 | -1

/** The game's input map, sending the Lock mode and the cycle as well. */
export interface LockInput extends InputMap {
  /** The player's saved Lock mode: play sets it on entry and when Settings closes. Toggle until then. */
  mode: LockMode
  /** Sends `lock-cycle { dir }` on the next tick (a drag or a flick). */
  cycle(dir: CycleDir): void
  /** Sends `equip { item }` on the next tick; a second ask before then replaces the first. */
  equip(item: ItemName): void
}

/** A camera drag this far, in CSS px, cycles while locked (§11.2). */
export const CYCLE_DRAG_PX = 40
/** A right stick pushed this far sideways cycles while locked (§11.2). */
export const CYCLE_FLICK = 0.7

/** `attach` builds an Input of its own; nothing reads its facts. */
const SILENT_BUS: PresentationBus = { publish: () => {}, subscribe: () => () => {} }

/**
 * `map` (the page's `inputs(...)`, four commands a tick) with the saved Lock mode in its `lock` command and a fifth,
 * `lock-cycle`, on the first tick a key of `cycleKeys` is held (by `KeyboardEvent.code`) or after a queued `cycle`.
 * Every command is renumbered `tick × 6 + n`, so the cycle (fifth) and a queued equip (sixth) have their own `seq`.
 */
export function lockInput(map: InputMap, cycleKeys: Readonly<Record<string, CycleDir>>): LockInput {
  // Each cycle key's action id: the key map gives every distinct payload its own action.
  const cycleActions = new Map<string, CycleDir>()
  for (const [action, binding] of Object.entries(map.profile.bindings))
    for (const code of binding.keys) {
      const dir = cycleKeys[code]
      if (dir !== undefined) cycleActions.set(action, dir)
    }

  let lastKeyDir: CycleDir | 0 = 0
  let queued: CycleDir | 0 = 0
  let queuedItem: ItemName | undefined

  const toCommand = (held: Iterable<string>, tick: number): readonly Command[] => {
    const actions = [...held]
    let keyDir: CycleDir | 0 = 0
    for (const action of actions) keyDir = cycleActions.get(action) ?? keyDir
    const pressed = keyDir !== 0 && keyDir !== lastKeyDir ? keyDir : 0
    lastKeyDir = keyDir
    const dir = pressed !== 0 ? pressed : queued
    queued = 0

    const inner = map.toCommand(actions, tick)
    const commands: Command[] = inner.map((command, index) => ({
      ...command,
      seq: tick * 6 + index,
      ...(command.type === Lock.id ? { payload: { ...(command.payload as object), mode: result.mode } } : {}),
    }))
    if (dir !== 0) commands.push({ tick, source: 0, seq: tick * 6 + 4, type: LockCycle.id, payload: { dir } })
    if (queuedItem !== undefined)
      commands.push({ tick, source: 0, seq: tick * 6 + 5, type: Equip.id, payload: { item: queuedItem } })
    queuedItem = undefined
    return commands
  }

  const result: LockInput = {
    ...map,
    mode: 'toggle',
    cycle(dir) {
      queued = dir
    },
    equip(item) {
      queuedItem = item
    },
    toCommand,
    attach(target) {
      // One Input over the map's bindings, in a scope of its own that `dispose` closes, as `inputs()` attaches.
      const scope = Effect.runSync(Scope.make())
      const input = Effect.runSync(
        makeInput({ target, profile: map.profile, bus: SILENT_BUS }).pipe(Scope.extend(scope)),
      )
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
  return result
}

/**
 * The camera drag's tracker, cycling once per drag when it has moved `CYCLE_DRAG_PX` from where it went down (right
 * is 1, as E is). Every sample still reaches `tracker`, which turns the camera; locked, the sim ignores the turn.
 */
export function cycleOnDrag(tracker: DragTracker, input: Pick<LockInput, 'cycle'>): DragTracker {
  let dragging: { id: number; fromX: number; cycled: boolean } | undefined
  return {
    down(id, x, start) {
      const drives = tracker.down(id, x, start)
      if (drives) dragging = { id, fromX: x, cycled: false }
      return drives
    },
    move(id, x) {
      tracker.move(id, x)
      if (dragging === undefined || dragging.id !== id || dragging.cycled) return
      const dx = x - dragging.fromX
      if (Math.abs(dx) < CYCLE_DRAG_PX) return
      dragging.cycled = true
      input.cycle(dx > 0 ? 1 : -1)
    },
    up(id) {
      tracker.up(id)
      if (dragging?.id === id) dragging = undefined
    },
    cancel() {
      tracker.cancel()
      dragging = undefined
    },
  }
}

/** The right stick's x each tick, −1..1: one cycle when it passes ±`CYCLE_FLICK`, again once it is back inside. */
export function cycleOnFlick(input: Pick<LockInput, 'cycle'>): (x: number) => void {
  let armed = true
  return (x) => {
    if (Math.abs(x) < CYCLE_FLICK) armed = true
    else if (armed) {
      armed = false
      input.cycle(x > 0 ? 1 : -1)
    }
  }
}
