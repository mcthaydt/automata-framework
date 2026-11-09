// What a bot sees and how it answers: the view a scene adapter reads from the sim, and the sim commands
// a bot gives, exactly as input does. Nothing here runs in the sim.
import type { Value } from '@automata/puzzle/sim'
import type { Point } from '@automata/sectors/sim'
import type { Command } from '@automata/sim'

/** A command before it is stamped with the tick it runs on. */
export type Order = Pick<Command, 'type' | 'payload'>

export interface BotView {
  /** Seconds since the run began, and one step's length. */
  readonly time: number
  readonly dt: number
  readonly player: Point
  /** The player is on a walk nav has not finished. */
  readonly walking: boolean
  /** The player's light is held up. */
  readonly lit: boolean
  readonly agents: readonly {
    readonly id: string
    readonly x: number
    readonly z: number
    readonly mode: string
  }[]
  /** The puzzle's hotspots by id. */
  readonly hotspots: Readonly<Record<string, Point>>
  readonly items: readonly string[]
  readonly facts?: Readonly<Record<string, Value>>
}

/**
 * One step of a bot's plan: a puzzle action (its hotspot or `code`, `combine`, `floor`), what it holds or combines,
 * a code, a floor point, and seconds to wait after it. An action `hide:<spot>` hides the player at that hotspot.
 */
export interface PlanStep {
  readonly action: string
  readonly at: string
  readonly held?: string | undefined
  readonly pair?: readonly [string, string] | undefined
  readonly code?: string | undefined
  readonly point?: Point | undefined
  readonly wait?: number | undefined
}

export const walkTo = (player: number, to: Point): Order => ({
  type: 'nav.walk-to',
  payload: { entity: player, to: { x: to.x, z: to.z } },
})

/** The verb a step gives, without the members it lacks (a command payload has no undefined). */
export function verbOf(step: Pick<PlanStep, 'at' | 'held' | 'pair' | 'code' | 'point'>): Order {
  const payload: Record<string, unknown> = { at: step.at }
  if (step.held !== undefined) payload.held = step.held
  if (step.pair !== undefined) payload.pair = [step.pair[0], step.pair[1]]
  if (step.code !== undefined) payload.code = step.code
  if (step.point !== undefined) payload.point = { x: step.point.x, z: step.point.z }
  return { type: 'puzzle.verb', payload }
}

/** The verb as a bot's token: `hotspot:item`, `floor:item`, `combine:a+b`, `code:0417`, `hide:spot`. */
export function tokenOf(step: Pick<PlanStep, 'action' | 'at' | 'held' | 'pair' | 'code'>): string {
  if (step.action.startsWith('hide:')) return step.action
  if (step.at === 'combine' && step.pair !== undefined) return `combine:${step.pair[0]}+${step.pair[1]}`
  if (step.at === 'code') return `code:${step.code ?? ''}`
  return step.held === undefined ? step.at : `${step.at}:${step.held}`
}
