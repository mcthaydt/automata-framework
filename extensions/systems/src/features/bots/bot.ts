// Bots: players made of code, for playtests. A bot sees what a
// player sees and answers with sim commands, so a bot's win is a win a player can have.
// - scripted: follows its plan: walks to each step's place, gives its verb, then waits as the step says; holds up the
//   light (when the scene has one) while an awake agent is within `THREAT_RANGE`, and puts it out after.
// - cautious: the same, and while an agent in a threat mode is within `THREAT_RANGE` it stands still (or, with
//   `evade`, steps away from it).
// - greedy: the plan with no waits, threats ignored; with `explore`, it sometimes skips a step or does something
//   random first.
// - random: samples verbs (hotspots with an item or a bare hand, combines, codes at the keypad) and walks.
// A bot's randomness comes from its own seed, never from the sim's RNG.

import type { Point } from '@automata/sectors/sim'
import { createRng, type Rng } from '@automata/sim'
import { type BotView, type Order, type PlanStep, tokenOf, verbOf, walkTo } from './view'

export type Policy = 'scripted' | 'cautious' | 'random' | 'greedy'
export const POLICIES: readonly Policy[] = ['scripted', 'cautious', 'random', 'greedy']
/** How near an agent is a threat, or worth a held-up light, in metres. */
export const THREAT_RANGE = 6
/** How close counts as being at a step's place. */
export const REACH = 0.6
/** How far an evading bot steps away from a threat. */
export const EVADE_STEP = 2

export interface BotOptions {
  /** The player's entity, for `nav.walk-to`. */
  readonly player: number
  readonly seed: number
  readonly plan?: readonly PlanStep[]
  /** The hotspot whose keypad takes codes. */
  readonly keypad?: string
  /** Codes the bot knows, typed at the keypad when a step has none. */
  readonly codes?: readonly string[]
  /** Agent modes that are a threat (default `hunt`). */
  readonly threats?: readonly string[]
  /** Threatened, the cautious bot steps away instead of standing still. */
  readonly evade?: boolean
  /** The scene's light command, when it has a light the bot holds up near awake agents. */
  readonly light?: (on: boolean) => Order
  /** Agent modes at rest: no reason to hold up a light. */
  readonly resting?: readonly string[]
  /** Greedy only: the chance of skipping a step, and of doing something random first. */
  readonly explore?: { readonly skip: number; readonly detour: number }
  /** Items worth combining, for the random bot. */
  readonly combines?: readonly (readonly [string, string])[]
}

export interface Bot {
  readonly policy: Policy
  /** The commands to give this step (often none). */
  next(view: BotView): readonly Order[]
  /** Every verb the bot gave, in order (see `tokenOf`), and `light` for the light. */
  readonly issued: string[]
  /** The plan is finished (scripted, cautious, greedy). */
  done(): boolean
  /** The player was caught and the scene reloaded: try the current step again. */
  restart(): void
}

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.z - b.z)

export function createBot(policy: Policy, options: BotOptions): Bot {
  const rng: Rng = createRng(options.seed)
  const plan = options.plan ?? []
  const threats = options.threats ?? ['hunt']
  const resting = options.resting ?? []
  const issued: string[] = []
  let index = 0
  let waitLeft = 0
  let walkingTo: Point | undefined
  let codeTried = 0

  /** Where a step is done: its hotspot, the keypad for a code, its floor point; none for a combine. */
  const placeOf = (step: PlanStep, view: BotView): Point | undefined => {
    if (step.point !== undefined) return step.point
    if (step.at === 'code') return options.keypad === undefined ? undefined : view.hotspots[options.keypad]
    const spot = step.action.startsWith('hide:') ? step.action.slice(5) : step.at
    return view.hotspots[spot]
  }
  /** The orders that do a step once the player is there. */
  const act = (step: PlanStep): Order => {
    const code =
      step.at === 'code' && step.code === undefined
        ? options.codes?.[codeTried++ % Math.max(1, options.codes.length)]
        : step.code
    const done = { ...step, code }
    issued.push(tokenOf(done))
    if (step.action.startsWith('hide:'))
      return { type: 'systems.hide', payload: { spot: step.action.slice(5) } }
    return verbOf(done)
  }
  /** Walks to `to`, once per destination; nothing while that walk is under way. */
  const goTo = (view: BotView, to: Point): Order[] => {
    if (view.walking && walkingTo !== undefined && distance(walkingTo, to) < 1e-9) return []
    walkingTo = to
    return [walkTo(options.player, to)]
  }

  const lightOrders = (view: BotView): Order[] => {
    if (options.light === undefined || (policy !== 'scripted' && policy !== 'cautious')) return []
    const awake = view.agents.some(
      (a) => !resting.includes(a.mode) && distance(a, view.player) < THREAT_RANGE,
    )
    if (awake === view.lit) return []
    issued.push('light')
    return [options.light(awake)]
  }

  /** A random verb or walk, from the bot's own seed. */
  function randomOrder(view: BotView): Order[] {
    const spots = Object.keys(view.hotspots).sort()
    const roll = rng.int(10)
    if (roll < 2 && options.combines !== undefined && options.combines.length > 0) {
      const pair = options.combines[rng.int(options.combines.length)] as readonly [string, string]
      return [act({ action: 'combine', at: 'combine', pair })]
    }
    if (roll < 3 && options.codes !== undefined && options.codes.length > 0)
      return [act({ action: 'code', at: 'code', code: options.codes[rng.int(options.codes.length)] })]
    if (roll < 5 || spots.length === 0) {
      const to = { x: view.player.x + (rng.next() - 0.5) * 6, z: view.player.z + (rng.next() - 0.5) * 6 }
      return goTo(view, to)
    }
    const at = spots[rng.int(spots.length)] as string
    const held =
      view.items.length > 0 && rng.next() < 0.5 ? view.items[rng.int(view.items.length)] : undefined
    return [act({ action: at, at, held })]
  }

  function planOrders(view: BotView): Order[] {
    if (waitLeft > 0) {
      waitLeft -= view.dt
      return []
    }
    const step = plan[index]
    if (step === undefined) return []
    if (policy === 'greedy' && options.explore !== undefined && walkingTo === undefined) {
      if (rng.next() < options.explore.skip) {
        index++
        return []
      }
      if (rng.next() < options.explore.detour) return randomOrder(view)
    }
    const place = placeOf(step, view)
    if (place !== undefined && distance(view.player, place) > REACH) return goTo(view, place)
    if (view.walking) return []
    walkingTo = undefined
    index++
    waitLeft = policy === 'greedy' ? 0 : (step.wait ?? 0)
    return [act(step)]
  }

  return {
    policy,
    issued,
    done: () => policy !== 'random' && index >= plan.length && waitLeft <= 0,
    restart: () => {
      waitLeft = 0
      walkingTo = undefined
    },
    next(view) {
      const lights = lightOrders(view)
      if (policy === 'cautious') {
        const threat = view.agents.find(
          (a) => threats.includes(a.mode) && distance(a, view.player) < THREAT_RANGE,
        )
        if (threat !== undefined) {
          walkingTo = undefined
          if (options.evade !== true)
            return [...lights, ...(view.walking ? [walkTo(options.player, view.player)] : [])]
          const d = Math.max(distance(threat, view.player), 1e-6)
          const away = {
            x: view.player.x + ((view.player.x - threat.x) / d) * EVADE_STEP,
            z: view.player.z + ((view.player.z - threat.z) / d) * EVADE_STEP,
          }
          return [...lights, walkTo(options.player, away)]
        }
      }
      if (lights.length > 0) return lights
      return policy === 'random' ? (view.walking ? [] : randomOrder(view)) : planOrders(view)
    },
  }
}
