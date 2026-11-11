// A game's refill of a carried light, and the numbers a carried light has. Which item does the refilling is the game's; the
// sim only keeps the fuel. The numbers (the pool's radius, the fuel it starts with, a refill, what it holds, how fast it burns)
// are data: a game reads `content/carried-light.toml` through `carriedLightContent` and gives the plugin and its own refill the
// result, so nothing of a lamp's arithmetic is written in source. Fuel is counted in ticks in the sim and in seconds in the file.
import type { SimContext } from '@automata/sim'
import { CarriedLight } from './carried-light.component'

/** The numbers of a carried light. The defaults are the old game's hand lamp. */
export interface CarriedLightDef {
  /** How far the lit light's pool reaches, in metres. */
  readonly radius: number
  /** Seconds of fuel the light has to begin with. */
  readonly start: number
  /** Seconds of fuel one refill adds. */
  readonly fill: number
  /** The most seconds of fuel it holds. */
  readonly cap: number
  /** Ticks of fuel a lit tick costs: 1 burns in real time, 2 twice as fast. Give less fuel for a shorter light. */
  readonly burn: number
}

/** The numbers a file or an option may give: any of them. */
export type CarriedLightFile = { readonly [K in keyof CarriedLightDef]?: number | undefined }

export const DEFAULT_CARRIED_LIGHT: CarriedLightDef = { radius: 2.2, start: 0, fill: 40, cap: 80, burn: 1 }

const NAMES = ['radius', 'start', 'fill', 'cap', 'burn'] as const

/** What is wrong with a carried light's numbers, by name, in words; empty when they are usable. */
export function carriedLightProblems(
  file: CarriedLightFile,
): { readonly name: keyof CarriedLightDef; readonly message: string }[] {
  const problems: { name: keyof CarriedLightDef; message: string }[] = []
  for (const name of NAMES) {
    const value = file[name]
    if (value === undefined) continue
    if (!Number.isFinite(value)) problems.push({ name, message: `${name} must be a number, not ${value}` })
    else if (name === 'radius' && value <= 0)
      problems.push({ name, message: `radius must be above 0, not ${value}` })
    else if (name === 'burn' && (!Number.isInteger(value) || value < 1))
      problems.push({
        name,
        message: `burn must be a whole number of 1 or more, not ${value} (ticks of fuel a lit tick costs; give less fuel for a shorter light)`,
      })
    else if (name !== 'radius' && name !== 'burn' && value < 0)
      problems.push({ name, message: `${name} must be a number of 0 or more, not ${value}` })
  }
  if (problems.length > 0) return problems
  // A refill, and what it starts with, must fit in what it holds: judged on the numbers it will have, the old game's included.
  const have = carriedLightDefOf(file, false)
  for (const name of ['fill', 'start'] as const)
    if (have[name] > have.cap)
      problems.push({
        name: file[name] === undefined ? 'cap' : name,
        message: `${name} (${have[name]} s) is more than cap (${have.cap} s): ${name === 'fill' ? 'a refill would never fit' : 'it could not start with that much'}`,
      })
  return problems
}

/** A carried light's numbers: the file's or the options' over the old game's. A number that cannot be one throws, in words. */
export function carriedLightDefOf(file: CarriedLightFile | undefined, check = true): CarriedLightDef {
  if (check) {
    const [first] = carriedLightProblems(file ?? {})
    if (first !== undefined) throw new Error(`carried light: ${first.message}`)
  }
  return {
    radius: file?.radius ?? DEFAULT_CARRIED_LIGHT.radius,
    start: file?.start ?? DEFAULT_CARRIED_LIGHT.start,
    fill: file?.fill ?? DEFAULT_CARRIED_LIGHT.fill,
    cap: file?.cap ?? DEFAULT_CARRIED_LIGHT.cap,
    burn: file?.burn ?? DEFAULT_CARRIED_LIGHT.burn,
  }
}

/** Seconds of fuel as ticks at the sim's rate (`sim.tickHz`): what a game gives the light it spawns, `fuelTicks`. */
export const fuelTicksOf = (seconds: number, tickHz: number): number => Math.round(seconds * tickHz)

/** Adds `ticks` of fuel to the carried light on `entity`, never past `cap`. Does nothing for an entity with no light. */
export function refuel(ctx: SimContext, entity: number, ticks: number, cap: number): void {
  const carrier = ctx.entity(entity)
  if (carrier === undefined || !carrier.has(CarriedLight)) return
  carrier.set(CarriedLight, { fuelTicks: Math.min(cap, carrier.get(CarriedLight).fuelTicks + ticks) })
}

/** A refill by the file's numbers: `def.fill` seconds of fuel, never past `def.cap`. */
export function refill(ctx: SimContext, entity: number, def: CarriedLightDef): void {
  const tickHz = Math.round(1 / ctx.dt)
  refuel(ctx, entity, fuelTicksOf(def.fill, tickHz), fuelTicksOf(def.cap, tickHz))
}
