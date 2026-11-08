// The feel on the Pixi stage: a game passes `feelStage(...)` as the renderer's `setup`, and the feel table plays in the
// running game. It hears the steps' events, shakes the world, draws the flash and the tint over the playfield, and hands
// the cues and the rumbles to the game's own ports (the game owns the sound and the haptics, feel owns when).
// Presentation only: it never writes the sim.

import {
  type Clock,
  type FrameInfo,
  type PixiStage,
  type PixiStageHooks,
  systemClock,
} from '@automata/framework'
import type { StepResult } from '@automata/sim'
import { Graphics } from 'pixi.js'
import {
  createFeel,
  DEFAULT_SETTINGS,
  type Feel,
  type FeelFrame,
  type FeelSettings,
  type Pulse,
} from '../features/frame/feel'
import type { FeelContent } from '../shared/feel.schema'

/** What a game gives `feelStage`: the table (read at each event, so a saved change shows on the next one) and its ports. */
export interface FeelStageOptions {
  readonly content: () => FeelContent
  /** The player's feel settings; the defaults when the game has none yet. */
  readonly settings?: (() => FeelSettings) | undefined
  readonly reducedMotion?: (() => boolean) | undefined
  readonly clock?: Clock | undefined
  /** An audio cue fires, once. The game plays it; without this the cue is not heard. */
  readonly onCue?: ((cue: string) => void) | undefined
  /** A rumble fires, once. The game's haptics port plays it. */
  readonly onHaptic?: ((pulse: Pulse) => void) | undefined
}

/** Far larger than any playfield; the stage's UI layer is masked to the playfield, so this covers all of it. */
const HUGE = 8192

/** The setup to hand to `createPixiRenderer({ setup })`. */
export function feelStage(options: FeelStageOptions): (stage: PixiStage) => PixiStageHooks {
  return (stage) => {
    const make = (): Feel =>
      createFeel({
        content: options.content,
        settings: options.settings ?? (() => DEFAULT_SETTINGS),
        reducedMotion: options.reducedMotion ?? (() => false),
        clock: options.clock ?? systemClock,
      })
    let feel = make()
    let tick = 0
    let shaken: readonly [number, number] = [0, 0]

    // One rectangle for the tint under one for the flash, so a flash is always seen over a tint.
    const tint = new Graphics()
    const flash = new Graphics()
    for (const layer of [tint, flash]) {
      layer.rect(-HUGE, -HUGE, HUGE * 2, HUGE * 2).fill(0xffffff)
      layer.visible = false
      layer.eventMode = 'none'
      stage.ui.addChild(layer)
    }

    const paint = (layer: Graphics, overlay: FeelFrame['flash']): void => {
      layer.visible = overlay !== null
      if (overlay === null) return
      layer.tint = overlay.colour
      layer.alpha = overlay.alpha
    }

    const putBack = (): void => {
      stage.world.position.x -= shaken[0]
      stage.world.position.y -= shaken[1]
      shaken = [0, 0]
    }

    return {
      apply(result: StepResult): void {
        tick = result.tick
        feel.hear(result.tick, result.events)
      },
      draw(info: FrameInfo): void {
        const frame = feel.frameNow(tick, info.alpha)
        // The world is moved by the change in the shake, so whatever else places it (the letterbox) is left alone.
        stage.world.position.x += frame.offset[0] - shaken[0]
        stage.world.position.y += frame.offset[1] - shaken[1]
        shaken = frame.offset
        paint(tint, frame.tint)
        paint(flash, frame.flash)
        for (const cue of frame.cues) options.onCue?.(cue)
        for (const pulse of frame.haptics) options.onHaptic?.(pulse)
      },
      reset(): void {
        putBack()
        feel = make()
        tick = 0
        tint.visible = false
        flash.visible = false
      },
    }
  }
}
