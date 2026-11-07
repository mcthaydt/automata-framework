// The kit's look passes: stars, rain and glow, each added after core's passes with `addLookPass` under its own name and its
// own switch (the option that adds it). Core's look has no stars, rain or bloom; a game that wants them adds these once,
// before it creates its renderer. A name already taken is refused by core (`RegistryClash`).

import { addLookPass, type Look, type LookPass, type TimeOfDay } from '@automata/3d'
import type { Pass3D } from '@pixi/3d'
import { Ticker } from 'pixi.js'
import { GlowEffect, type GlowOptions } from './glow-effect.ts'
import { RainEffect } from './rain-effect.ts'
import { duelTriple } from './shader-parts.ts'
import { StarsEffect } from './stars-effect.ts'

export interface RainOptions {
  /** How many columns have a streak, 0 to 1 (default 0.5). */
  readonly density?: number
  /** The streak's colour, snapped to DUEL (default a cool blue). */
  readonly colour?: string
}

export interface SkyPassOptions {
  /** Stars where the sky shows, as thick as the time of day's `stars` (default on). */
  readonly stars?: boolean
  /** A stepped glow round the brightest pixels (default on). */
  readonly glow?: boolean | GlowOptions
  /** Rain, off unless given. */
  readonly rain?: false | RainOptions
}

/** The names the passes are added under. */
export const SKY_PASS_NAMES = {
  stars: 'world-kit:stars',
  glow: 'world-kit:glow',
  rain: 'world-kit:rain',
} as const

/** Drives a pass's clock from Pixi's shared ticker until the pass is destroyed. */
function clocked<T extends Pass3D & { clock: number }>(pass: T): T {
  let seconds = 0
  const tick = (ticker: Ticker): void => {
    seconds += ticker.deltaMS / 1000
    pass.clock = seconds
  }
  Ticker.shared.add(tick)
  const destroy = pass.destroy.bind(pass)
  pass.destroy = (): void => {
    Ticker.shared.remove(tick)
    destroy()
  }
  return pass
}

/** The passes `options` ask for, as core's `LookPass` makers, in the order they run: stars, glow, rain. */
export function skyLookPasses(options: SkyPassOptions = {}): LookPass[] {
  const passes: LookPass[] = []
  if (options.stars !== false)
    passes.push({
      name: SKY_PASS_NAMES.stars,
      make: (_look: Look, time: TimeOfDay) => {
        const density = time.scene.stars ?? 0
        return clocked(new StarsEffect(density, { enabled: density > 0 }))
      },
    })
  if (options.glow !== false)
    passes.push({
      name: SKY_PASS_NAMES.glow,
      make: () => new GlowEffect(typeof options.glow === 'object' ? options.glow : {}),
    })
  if (options.rain !== undefined && options.rain !== false) {
    const rain = options.rain
    passes.push({
      name: SKY_PASS_NAMES.rain,
      make: () => clocked(new RainEffect(rain.density ?? 0.5, duelTriple(rain.colour ?? '#88d6ff'))),
    })
  }
  return passes
}

/** Adds the passes `options` ask for to core's look. */
export function addSkyPasses(options: SkyPassOptions = {}): void {
  for (const pass of skyLookPasses(options)) addLookPass(pass)
}
