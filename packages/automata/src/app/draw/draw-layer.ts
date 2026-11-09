// The read-only `draw(ctx)` layer: immediate-mode shapes and text for a HUD, a debug overlay or
// a prototype, drawn each display frame over the entity views. It reads the sim through `readSim` and never
// writes it (law 1). It is built on the renderer's stage hooks, so render-pixi is unchanged.
//
// Immediate mode on a retained scene graph (plan D-6): one Graphics is cleared and redrawn each frame, and text
// labels are pooled by call order (the nth `text` call reuses the nth label, unused ones are hidden), so a steady
// HUD allocates no display objects after its first frame. Shapes draw in the pixel picture; text draws on the
// stage's `hud` layer above it, sharp at any screen size.

import type { Sim, StepResult } from '@automata/sim'
import { Container, Graphics } from 'pixi.js'
import type { HudBox, HudLabel } from '../../features/hud-text/hud-label.ts'
import { HUD_TEXT_FLOOR } from '../../features/hud-text/hud-size.ts'
import { createHudText, type HudText } from '../../features/hud-text/hud-text.ts'
import {
  drawLevelScene,
  type LevelScene,
  mountLevelScene,
} from '../../features/render/level-2d/level-scene.ts'
import type { PixiStage, PixiStageHooks } from '../../features/render/renderer.ts'
import { type DrawSim, readSim } from '../../shared/draw/read-sim.ts'
import type { FrameInfo } from '../../shared/runtime/loop/frames.ts'

/**
 * Options for `DrawContext.text`. Text is never smaller than 12 CSS px on screen, so a size in logical pixels that
 * is smaller than that on this screen is raised to fit; the box `text` returns is the size it took.
 */
export interface DrawTextOptions {
  /** Default 0xffffff. */
  readonly color?: number | undefined
  /** Font size in logical pixels. Default 8. */
  readonly size?: number | undefined
  /** Which point of the text's box sits at (x, y), 0 to 1 each way. Default `{ x: 0, y: 0 }`, the top-left. */
  readonly anchor?: { readonly x: number; readonly y: number } | undefined
  /** A dark shadow behind the letters, for text over busy art. Default off. */
  readonly shadow?: boolean | undefined
}

/** The box a `text` call took, in logical pixels, after the size floor. */
export type DrawTextBox = HudBox

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
  /**
   * One line of text, its top-left at (x, y) unless `anchor` says otherwise. It draws on the stage's `hud` layer
   * (the canvas one, not the DOM `hud.overlay` slot), so it is above every shape whatever the call order and no
   * post filter touches it. Returns the box it took, so a panel behind it can fit.
   */
  text(value: string, x: number, y: number, options?: DrawTextOptions): DrawTextBox
}

export interface DrawLayer {
  /** The sim to read from now on; `undefined` clears the layer and stops calling `draw`. */
  watch(sim: Sim | undefined): void
  /**
   * For `PixiRendererOptions.setup`: mounts the shapes on the stage's ui layer, the text on its hud layer, and returns
   * its frame hook.
   */
  setup(stage: Pick<PixiStage, 'ui' | 'hud' | 'hudScale'> & Partial<Pick<PixiStage, 'world'>>): PixiStageHooks
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

/**
 * The layer behind `draw` and `level`: it hands the sim it watches to the level scene (a stage hook's `FrameInfo`
 * carries no sim) and to `draw`. Either may be absent.
 */
export function createDrawLayer(
  draw: ((ctx: DrawContext) => void) | undefined,
  size: { readonly width: number; readonly height: number },
  level?: LevelScene,
): DrawLayer {
  let view: DrawSim | undefined
  let root = new Container({ label: 'draw' })
  let graphics = new Graphics()
  root.addChild(graphics)
  // Made on the first `text` call, so a `draw` that only writes shapes never loads a font.
  let stage: Parameters<DrawLayer['setup']>[0] | undefined
  let hudText: HudText | undefined
  const labels: HudLabel[] = []
  let labelsUsed = 0

  const hideUnusedLabels = (): void => {
    for (let i = labelsUsed; i < labels.length; i++) (labels[i] as HudLabel).hide()
  }
  const clear = (): void => {
    graphics.clear()
    labelsUsed = 0
    hideUnusedLabels()
  }
  const nextLabel = (): HudLabel => {
    let label = labels[labelsUsed]
    if (label === undefined) {
      if (stage === undefined) throw new Error('draw layer: text before setup')
      hudText ??= createHudText(stage)
      label = hudText.label()
      labels.push(label)
    }
    labelsUsed++
    return label
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
    text: (value, x, y, options = {}) =>
      nextLabel().set(value, x, y, {
        size: options.size ?? 8,
        floor: HUD_TEXT_FLOOR,
        color: options.color ?? 0xffffff,
        shadow: options.shadow ?? false,
        anchor: options.anchor,
      }),
  })

  return {
    watch(sim) {
      view = sim === undefined ? undefined : readSim(sim)
      if (view === undefined) {
        clear()
        if (level !== undefined) drawLevelScene(level, undefined)
      }
    },
    setup(mountedOn) {
      // A renderer that rebuilds its app (the 3D "Try again" after a lost graphics context) calls `setup` again on a
      // new stage and destroys the old one's containers: the shapes and the labels start over on the new one.
      if (stage !== undefined && stage !== mountedOn) {
        root = new Container({ label: 'draw' })
        graphics = new Graphics()
        root.addChild(graphics)
        hudText?.destroy()
        hudText = undefined
        labels.length = 0
        labelsUsed = 0
      }
      stage = mountedOn
      mountedOn.ui.addChild(root)
      if (level !== undefined && mountedOn.world !== undefined)
        mountLevelScene(level, mountedOn.world, mountedOn.ui)
      return {
        draw(frame) {
          if (view === undefined) return
          if (level !== undefined) drawLevelScene(level, view)
          if (draw === undefined) return
          clear()
          draw(ctx(view, frame))
          hideUnusedLabels()
        },
      }
    },
  }
}
