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
import { Graphics, Text } from 'pixi.js'
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
  /**
   * A word's text in the player's language: given where the words sit in the feel file and what was authored (the
   * game's content text). Without it the authored words show.
   */
  readonly translate?: ((path: readonly (string | number)[], authored: string) => string) | undefined
  /**
   * What was drawn, once per frame, after it was drawn: the shake's offset, the flash and tint, the words and the squashes.
   * For a debug panel or a journey that checks what the player saw; the stage itself needs nothing from it.
   */
  readonly onFrame?: ((frame: FeelFrame) => void) | undefined
  /** The playfield's logical size: a word with no subject shows in the middle of it. Default 320 by 180. */
  readonly size?: { readonly width: number; readonly height: number } | undefined
}

/** A word rises as it ages (unless motion is reduced) and sits above its subject's view. */
const WORD_RISE_PX_PER_SECOND = 16
const WORD_ABOVE_PX = 12

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

    // A pool of words, one Text each, reused from frame to frame.
    const wordTexts: Text[] = []
    const showWords = (words: FeelFrame['words']): void => {
      const size = options.size ?? { width: 320, height: 180 }
      let used = 0
      for (const word of words) {
        if (word.words === undefined) continue
        let text = wordTexts[used]
        if (text === undefined) {
          text = new Text({
            text: '',
            style: { fontSize: 10, fill: 0xffffff, stroke: { color: 0x000000, width: 2 }, align: 'center' },
          })
          text.anchor.set(0.5, 1)
          text.eventMode = 'none'
          wordTexts.push(text)
          stage.ui.addChild(text)
        }
        used += 1
        text.text = options.translate?.(word.path ?? [], word.words) ?? word.words
        const subject = word.at === null ? undefined : stage.characters.point(word.at)
        const at = subject ?? { x: size.width / 2, y: size.height / 2 }
        const rise = word.still ? 0 : word.age * WORD_RISE_PX_PER_SECOND
        text.position.set(at.x, at.y - (subject === undefined ? 0 : WORD_ABOVE_PX) - rise)
        text.visible = true
      }
      for (let i = used; i < wordTexts.length; i += 1) (wordTexts[i] as Text).visible = false
    }

    // The refs squashed on the last frame, so the ones the spring has settled are put back exactly once.
    let squashed = new Set<number>()
    const showSquash = (frame: FeelFrame): void => {
      for (const [ref, [sx, sy]] of frame.squash) stage.characters.squash(ref, sx, sy)
      for (const ref of squashed) if (!frame.squash.has(ref)) stage.characters.rest(ref)
      squashed = new Set(frame.squash.keys())
    }

    // The shake moves the world through its pivot, which nothing else uses, so whoever places the world (the letterbox, a
    // camera that rewrites its position every frame) is left alone. The pivot is in the world's own units.
    const shake = (offset: readonly [number, number]): void => {
      const { x: sx, y: sy } = stage.world.scale
      stage.world.pivot.set(0 - offset[0] / (sx || 1), 0 - offset[1] / (sy || 1))
    }

    return {
      apply(result: StepResult): void {
        tick = result.tick
        feel.hear(result.tick, result.events)
      },
      draw(info: FrameInfo): void {
        const frame = feel.frameNow(tick, info.alpha)
        shake(frame.offset)
        paint(tint, frame.tint)
        paint(flash, frame.flash)
        // A hit-stop holds the subject's pose; the picture catches up when it ends.
        stage.characters.hold(new Set(frame.frozen))
        showSquash(frame)
        showWords(frame.words)
        for (const cue of frame.cues) options.onCue?.(cue)
        for (const pulse of frame.haptics) options.onHaptic?.(pulse)
        options.onFrame?.(frame)
      },
      reset(): void {
        stage.characters.hold(new Set())
        for (const ref of squashed) stage.characters.rest(ref)
        squashed.clear()
        for (const text of wordTexts) text.visible = false
        shake([0, 0])
        feel = make()
        tick = 0
        tint.visible = false
        flash.visible = false
      },
    }
  }
}
