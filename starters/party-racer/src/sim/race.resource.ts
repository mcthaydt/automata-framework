import { defineResource, type ResourceDef } from '@mcthaydt/automata-sim'
import { z } from 'zod'

// The race as a whole (FloorFifty's `RaceState` beyond its players and floors): its phase, when it started, and the
// result. Standings and the winner are written by the lap rule and nowhere else.

/** The race's state; see the schema below for each field. */
export interface RaceState {
  phase: 'waiting' | 'racing' | 'finished'
  startedAt: number
  courseSeed: number
  standings: number[]
  winner: number
}

const raceSchema: z.ZodType<RaceState> = z
  .object({
    /** `waiting` until `race.start`, `racing`, then `finished` once the first racer completes the last lap. */
    phase: z.enum(['waiting', 'racing', 'finished']),
    /** The tick `race.start` ran on. */
    startedAt: z.number().int().min(0),
    courseSeed: z.number().int().min(0),
    /** Seats in finishing order. */
    standings: z.array(z.number().int().min(0)),
    /** The winning seat, or -1. */
    winner: z.number().int().min(-1),
  })
  .strict()

/** The race's phase, start tick, course seed, standings and winner. */
export const Race: ResourceDef<z.ZodType<RaceState>> = defineResource('party-racer.race', raceSchema, () => ({
  phase: 'waiting',
  startedAt: 0,
  courseSeed: 0,
  standings: [],
  winner: -1,
}))
