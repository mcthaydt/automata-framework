// The look's passes, in the order they run: the DUEL snap, then the outline when it is switched on, the sky (its stars are
// the `stars` switch's), the glow, the reflections, the shafts, the rain, then the passes extensions added with `addLookPass`, then the finish, always
// last. An extension's pass has its own switch and keeps the frame's alpha, which the finish reads.

import type { Pass3D, View3D } from '@pixi/3d'
import { RegistryClash } from '../../shared/registry/registry-clash.ts'
import type { TimeOfDay } from '../../shared/time-of-day/time-of-day.ts'
import { DuelSnapEffect } from './duel-snap-filter.ts'
import { FinishEffect } from './finish-effect.ts'
import type { Look } from './look.schema.ts'
import { MOODS, moodRemap } from './moods.ts'
import { OutlineEffect } from './outline-filter.ts'
import { GlowEffect } from './passes/glow-effect.ts'
import { RainEffect } from './passes/rain-effect.ts'
import { ReflectEffect } from './passes/reflect-effect.ts'
import { duelTriple } from './passes/shader-parts.ts'
import { ShaftsEffect } from './passes/shafts-effect.ts'
import { type HorizonLayer, SkyEffect } from './passes/sky-effect.ts'

/** A pass an extension adds after core's: `make` builds it for a look and a time of day. */
export interface LookPass {
  readonly name: string
  make(look: Look, time: TimeOfDay): Pass3D
}

export interface LookPasses {
  /** Every pass, in order: assign it to `view.passes`. */
  readonly list: readonly Pass3D[]
  readonly snap: DuelSnapEffect
  readonly outline: OutlineEffect | undefined
  /** The sky where nothing is drawn: the time's bands, the level's horizon, and the stars the `stars` switch allows. */
  readonly sky: SkyEffect
  readonly glow: GlowEffect | undefined
  /** Wet ground's reflections, when the look allows them and the time of day has rain. */
  readonly reflect: ReflectEffect | undefined
  /** Spot lamps' light shafts, when the look allows them. */
  readonly shafts: ShaftsEffect | undefined
  /** Rain, when the look allows it and the time of day has some. */
  readonly rain: RainEffect | undefined
  /** The extensions' passes, in registration order. */
  readonly extra: readonly Pass3D[]
  /** The last pass: it turns the frame's codes into what the stage blends and applies the mood. */
  readonly finish: FinishEffect
  /** Sets the clock the sky's clouds and stars and the rain run by, in seconds. */
  tick(seconds: number): void
  /** Tells the passes that read the camera (the reflections) where it stands, each frame. */
  camera(view: View3D): void
  /** Tells the sky where the camera looks, in radians: the bearing to the right and the pitch (up is positive). */
  aim(yaw: number, pitch: number): void
}

const REGISTERED: LookPass[] = []

/** Registers a pass that runs after core's. Throws `RegistryClash` on a name already taken. */
export function addLookPass(pass: LookPass): void {
  if (REGISTERED.some((p) => p.name === pass.name)) throw new RegistryClash('look pass', pass.name)
  REGISTERED.push(pass)
}

/** The registered passes, in registration order. */
export const registeredLookPasses = (): readonly LookPass[] => REGISTERED

/**
 * The passes for `look` at `time`, with the level's `horizon` (its layers' colours resolved) standing on the sky. The snap
 * always runs: a frame is DUEL or it is not the look.
 */
export function createLookPasses(
  look: Look,
  time: TimeOfDay,
  horizon: readonly HorizonLayer[] = [],
): LookPasses {
  const snap = new DuelSnapEffect(look.switches.dither ? look.dither.strength : 0)
  const outline = look.switches.outline ? new OutlineEffect(look.outline.edge) : undefined
  const sky = new SkyEffect(look.switches.stars ? time : withoutStars(time), horizon)
  const glow = look.switches.glow ? new GlowEffect({}) : undefined
  const raining = look.switches.rain ? time.scene.rain : undefined
  const wet = raining === undefined || raining.density <= 0 ? 0 : raining.density
  const reflect = look.switches.reflect && wet > 0 ? new ReflectEffect(wet) : undefined
  const shafts = look.switches.shafts ? new ShaftsEffect() : undefined
  const rain =
    raining === undefined || raining.density <= 0
      ? undefined
      : new RainEffect(raining.density, duelTriple(raining.colour))
  const extra = REGISTERED.map((pass) => pass.make(look, time))
  const mood = look.mood === undefined || !look.switches.grade ? undefined : MOODS[look.mood]
  if (look.mood !== undefined && MOODS[look.mood] === undefined)
    throw new Error(
      `The look names the mood "${look.mood}", which there is not. The moods are: ${Object.keys(MOODS).join(', ')}.`,
    )
  const finish = new FinishEffect(mood === undefined ? undefined : moodRemap(mood))
  return {
    list: [
      snap,
      ...(outline ? [outline] : []),
      sky,
      ...(glow ? [glow] : []),
      ...(reflect ? [reflect] : []),
      ...(shafts ? [shafts] : []),
      ...(rain ? [rain] : []),
      ...extra,
      finish,
    ],
    snap,
    outline,
    sky,
    glow,
    reflect,
    shafts,
    rain,
    extra,
    finish,
    tick: (seconds) => {
      sky.clock = seconds
      if (rain !== undefined) rain.clock = seconds
      if (reflect !== undefined) reflect.clock = seconds
      if (shafts !== undefined) shafts.clock = seconds
    },
    camera: (view) => {
      reflect?.camera(view)
      shafts?.camera(view)
    },
    aim: (yaw, pitch) => sky.aim(yaw, pitch),
  }
}

/** The time with no stars: the `stars` switch off leaves the night's sky bare. */
const withoutStars = (time: TimeOfDay): TimeOfDay => ({ ...time, scene: { ...time.scene, stars: 0 } })
