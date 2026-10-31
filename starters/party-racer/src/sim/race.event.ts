import { defineEvent, type EventDef } from '@mcthaydt/automata-sim'
import { z } from 'zod'

// The race's events (FloorFifty's `RaceEvent`, race mode): what presentation, audio and the room hear.

const seat: z.ZodNumber = z.number().int().min(0)

export interface FloorLandedPayload {
  readonly seat: number
  readonly floor: number
}
const floorLandedSchema: z.ZodType<FloorLandedPayload> = z.object({ seat, floor: z.number().int().min(0) })
/** A racer was credited a floor, once per ascent. */
export const FloorLanded: EventDef<z.ZodType<FloorLandedPayload>> = defineEvent(
  'race.floor-landed',
  floorLandedSchema,
)

export interface LapCompletedPayload {
  readonly seat: number
  readonly lap: number
}
const lapSchema: z.ZodType<LapCompletedPayload> = z.object({ seat, lap: z.number().int().min(1) })
/** A racer completed ascent `lap` and starts the next from the spawn. */
export const LapCompleted: EventDef<z.ZodType<LapCompletedPayload>> = defineEvent(
  'race.lap-completed',
  lapSchema,
)

export interface RacerResetPayload {
  readonly seat: number
  readonly reason: 'fall' | 'manual'
}
const resetSchema: z.ZodType<RacerResetPayload> = z.object({ seat, reason: z.enum(['fall', 'manual']) })
/** A racer went back to the start of their ascent: they fell below the death line, or sent `race.reset`. */
export const RacerReset: EventDef<z.ZodType<RacerResetPayload>> = defineEvent('race.racer-reset', resetSchema)

export interface RaceFinishedPayload {
  readonly winner: number
}
const finishedSchema: z.ZodType<RaceFinishedPayload> = z.object({ winner: seat })
/** The first racer completed the last lap; the race is over. */
export const RaceFinished: EventDef<z.ZodType<RaceFinishedPayload>> = defineEvent(
  'race.finished',
  finishedSchema,
)
