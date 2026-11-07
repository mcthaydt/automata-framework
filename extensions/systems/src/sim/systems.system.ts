// The systems' step (M6 spec §4.6, §5), in `gameplay`: hiding commands, then (when the def asks about portals) the
// player's crossing, then the world rules in order (a catch or a cutscene halts the rest of the step), then every
// agent in the def's order. Noises age in `cleanup`. `hear` makes a noise and has the systems react at once.
import type { SimContext, SystemDef } from '@automata/sim'
import { defineSystem } from '@automata/sim'
import { hearAgent, stepAgent } from './agent-step'
import { applyEffects, makeNoise } from './effect'
import { holds } from './probe'
import { hearsIn, usesPortals } from './probe-kinds'
import { hide, track, unhide } from './pursuit'
import { Hide, Unhide } from './systems.command'
import { type Noise, SystemsNoises, SystemsScene } from './systems.resource'
import { commit, type SystemsOptions, type SystemsWorld, worldOf } from './world'

/** Seconds a noise stays on the world, for the renderer's rings. */
export const NOISE_LIFE = 1.2

/** A noise is made: on the world, emitted, then heard by the rules and agents that listen for it. */
function heardIn(w: SystemsWorld): (noise: Noise) => void {
  const react = (noise: Noise): void => {
    makeNoise(w, noise)
    const before = w.hearing
    w.hearing = noise
    for (const rule of w.def.rules)
      if (hearsIn(rule.when) && holds(w, rule.when, { id: null, clock: 0 }))
        applyEffects(w, rule.then, { id: null, clock: 0 }, react)
    for (const def of w.def.agents) hearAgent(w, def, react)
    w.hearing = before
  }
  return react
}

/** The world rules that tick, in order. True when one caught the player or started a cutscene: the step halts. */
function rules(w: SystemsWorld, heard: (n: Noise) => void): boolean {
  if (usesPortals(w.def)) track(w)
  const clocks = w.state.clocks
  for (const rule of w.def.rules) {
    if (hearsIn(rule.when)) continue
    const clock = (clocks[rule.id] ?? 0) + w.ctx.dt
    clocks[rule.id] = clock
    if (rule.every !== undefined && clock + 1e-9 < rule.every) continue
    if (!holds(w, rule.when, { id: null, clock })) continue
    clocks[rule.id] = 0
    if (applyEffects(w, rule.then, { id: null, clock }, heard) !== null) return true
  }
  return false
}

export const systemsStepSystem = (options: SystemsOptions): SystemDef =>
  defineSystem('systems.step', 'gameplay', (ctx) => {
    const w = worldOf(ctx, options)
    if (w === undefined) return
    for (const _ of ctx.commands.of(Unhide)) unhide(w)
    for (const { payload } of ctx.commands.of(Hide)) {
      unhide(w)
      hide(w, payload.spot)
    }
    // Hidden, moving brings the player out; standing, she stays hidden a little longer.
    if (w.pursuit.hidden !== '') {
      if (w.env.moving) unhide(w)
      else w.pursuit.hiddenFor += ctx.dt
    }
    const heard = heardIn(w)
    if (!rules(w, heard)) for (const def of w.def.agents) stepAgent(w, def, heard)
    commit(w)
  })

export const systemsNoiseAgeSystem: SystemDef = defineSystem('systems.noise-age', 'cleanup', (ctx) => {
  const resource = ctx.resource(SystemsNoises)
  resource.noises = resource.noises.filter((n) => {
    n.age += ctx.dt
    return n.age < NOISE_LIFE
  })
})

/** Makes a noise from any sim system (puzzle's `noise` option, a game's): heard on the step it is made (SY-D2). */
export const hearWith =
  (options: SystemsOptions) =>
  (
    ctx: SimContext,
    noise: {
      readonly at: { readonly x: number; readonly z: number }
      readonly loudness: number
      readonly kind: string
    },
  ): void => {
    const made: Noise = { x: noise.at.x, z: noise.at.z, loudness: noise.loudness, kind: noise.kind, age: 0 }
    const w = worldOf(ctx, options)
    if (w === undefined) {
      // No scene loaded: the noise is on the world and emitted, and nothing listens.
      ctx.resource(SystemsNoises).noises.push(made)
      return
    }
    heardIn(w)(made)
    commit(w)
  }

export const sceneLoaded = (ctx: SimContext): boolean => ctx.resource(SystemsScene).def !== null
