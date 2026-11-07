// The read-only `draw(ctx)` layer (PRODUCT spec §7): immediate-mode shapes and text for a HUD, a debug overlay or
// a prototype, drawn each display frame over the entity views. It reads the sim through `readSim` and never
// writes it (law 1). It is built on the renderer's stage hooks (DX.3 decision E-1), so render-pixi is unchanged.
//
// Immediate mode on a retained scene graph (plan D-6): one Graphics is cleared and redrawn each frame, and Text
// objects are pooled by call order (the nth `text` call reuses the nth Text, unused ones are hidden), so a steady
// HUD allocates no display objects after its first frame.

import type { Sim, StepResult } from '@mcthaydt/automata-sim'
import { Container, Graphics, Text } from 'pixi.js'
import type { PixiStage, PixiStageHooks } from '../../features/render/renderer.ts'
import type { FrameInfo } from '../../shared/runtime/loop/frames.ts'
import { type DrawSim, readSim } from './read-sim.ts'

/** Options for `DrawContext.text`: colour and font size. */
export interface DrawTextOptions {
  /** Default 0xffffff. */
  readonly color?: number | undefined
  /** Font size in logical pixels. Default 8. */
  readonly size?: number | undefined
}

/** What `draw` receives each frame. Coordinates are logical playfield pixels (plan D-2). */
export interface DrawContext {
  /** The sim at this frame, read-only. */
  readonly sim: DrawSim
  readonly frame: FrameInfo
  /** The playfield's logical size. */
  readonly width: number
  readonly height: number
  rect(x: number, y: number, w: number, h: number, color: number): void
  circle(x: number, y: number, radius: number, color: number): void
  line(x1: number, y1: number, x2: number, y2: number, color: number, width?: number): void
  /** One line of text, its top-left at (x, y). */
  text(value: string, x: number, y: number, options?: DrawTextOptions): void
}

export interface DrawLayer {
  /** The sim to read from now on; `undefined` clears the layer and stops calling `draw`. */
  watch(sim: Sim | undefined): void
  /** For `PixiRendererOptions.setup`: mounts the layer on the stage's ui layer and returns its frame hook. */
  setup(stage: Pick<PixiStage, 'ui'>): PixiStageHooks
}

/** Every hook of each, called in the order given; `undefined` entries are skipped. */
export function mergeStageHooks(...all: readonly (PixiStageHooks | undefined)[]): PixiStageHooks {
  const hooks = all.filter((each): each is PixiStageHooks => each !== undefined)
  return {
    apply: (result: StepResult) => {
      for (const each of hooks) each.apply?.(result)
    },
    draw: (frame: FrameInfo) => {
      for (const each of hooks) each.draw?.(frame)
    },
    reset: () => {
      for (const each of hooks) each.reset?.()
    },
  }
}

export function createDrawLayer(
  draw: (ctx: DrawContext) => void,
  size: { readonly width: number; readonly height: number },
): DrawLayer {
  let view: DrawSim | undefined
  const root = new Container({ label: 'draw' })
  const graphics = new Graphics()
  root.addChild(graphics)
  const texts: Text[] = []
  let textsUsed = 0

  const hideUnusedTexts = (): void => {
    for (let i = textsUsed; i < texts.length; i++) (texts[i] as Text).visible = false
  }
  const clear = (): void => {
    graphics.clear()
    textsUsed = 0
    hideUnusedTexts()
  }

  const ctx = (sim: DrawSim, frame: FrameInfo): DrawContext => ({
    sim,
    frame,
    width: size.width,
    height: size.height,
    rect: (x, y, w, h, color) => void graphics.rect(x, y, w, h).fill(color),
    circle: (x, y, radius, color) => void graphics.circle(x, y, radius).fill(color),
    line: (x1, y1, x2, y2, color, width = 1) =>
      void graphics.moveTo(x1, y1).lineTo(x2, y2).stroke({ color, width }),
    text: (value, x, y, options = {}) => {
      let text = texts[textsUsed]
      if (text === undefined) {
        text = new Text({ text: '' })
        texts.push(text)
        root.addChild(text)
      }
      textsUsed++
      text.text = value
      text.style.fill = options.color ?? 0xffffff
      text.style.fontSize = options.size ?? 8
      text.position.set(x, y)
      text.visible = true
    },
  })

  return {
    watch(sim) {
      view = sim === undefined ? undefined : readSim(sim)
      if (view === undefined) clear()
    },
    setup(stage) {
      stage.ui.addChild(root)
      return {
        draw(frame) {
          if (view === undefined) return
          clear()
          draw(ctx(view, frame))
          hideUnusedTexts()
        },
      }
    },
  }
}
