// The Studio stage's renderer (EDS.9a; editor suite spec EDS-D13): one Pixi WebGL2 renderer with one `View3D`, drawing
// the figure exactly as the game does, with `@automata/3d`'s own `figure` view (its meshes, its evaluate, its hair),
// from the library and motion content the Studio read. The orbit comes from the stage camera's maths; the view's
// clock is the playhead, so scrubbing a clip shows the pose `sample` gives at that time. Losing the context pauses it
// and the stage offers Try again, as the 3D level editor's views do (ED3D spec §11); the fields keep working.
import '@automata/3d/no-eval'
import { type FigureViewState, figure } from '@automata/3d'
import type { FigureDef, FigureLibrary, MotionLibrary } from '@automata/3d/figures'
import { View3D } from '@pixi/3d'
import { autoDetectRenderer, Container, type Renderer, type WebGLRenderer } from 'pixi.js'
import { type Readable, writable } from 'svelte/store'
import { basis, type Orbit, type Size } from './stage-camera'

export interface StageSize extends Size {
  readonly resolution: number
}

export interface StageRenderer {
  readonly paused: Readable<boolean>
  /** Draws `def` from the libraries, replacing what was drawn; `undefined` clears the stage. */
  show(def: FigureDef | undefined, library: FigureLibrary, motion: MotionLibrary): void
  /** The figure's state (outfit, stance, the action playing) and the time it is drawn at, in seconds. */
  pose(state: FigureViewState, time: number): void
  /** The figure's facing, radians about +y. */
  face(yaw: number): void
  look(orbit: Orbit): void
  resize(size: StageSize): void
  /** Draws a frame now. */
  render(): void
  destroy(): void
}

export type StageRendererFactory = (
  canvas: HTMLCanvasElement,
  size: StageSize,
  background: number,
) => Promise<StageRenderer | undefined>

/** A Pixi renderer on WebGL2, or `undefined`: a `View3D` draws on nothing else (AGENTS.md: WebGL2 by default). */
async function webgl2(
  canvas: HTMLCanvasElement,
  size: StageSize,
  background: number,
): Promise<Renderer | undefined> {
  let renderer: Renderer
  try {
    renderer = await autoDetectRenderer({
      canvas,
      width: size.w,
      height: size.h,
      resolution: size.resolution,
      antialias: true,
      background,
      preference: ['webgl'],
      preferWebGLVersion: 2,
    })
  } catch {
    return undefined
  }
  if (renderer.name === 'webgl' && (renderer as WebGLRenderer).context.webGLVersion === 2) return renderer
  renderer.destroy({ removeView: false })
  return undefined
}

interface Drawing {
  readonly container: unknown
  update(curr: unknown, prev: unknown, alpha: number): void
  destroy(): void
}

export const createStageRenderer: StageRendererFactory = async (canvas, size, background) => {
  const made = await webgl2(canvas, size, background)
  if (made === undefined) return undefined
  const renderer: Renderer = made
  const stage = new Container()
  const view = new View3D({ width: size.w, height: size.h, toneMapping: 'none' })
  // The figure is drawn as the game's examples draw one: a sky and a ground colour for the ambient light, and a flat floor of it.
  view.environment = { skyColor: 0xc7dcd0, groundColor: 0x6a6270 }
  stage.addChild(view)
  const paused = writable(false)
  let lost = false
  let destroyed = false
  let drawing:
    | {
        readonly container: unknown
        update(curr: unknown, prev: unknown, alpha: number): void
        destroy(): void
      }
    | undefined
  let state: FigureViewState = { moving: false }
  let time = 0
  let yaw = 0

  const components = () => ({ model: { x: 0, y: 0, z: 0, yaw } })

  function render(): void {
    if (lost || destroyed) return
    drawing?.update({ components: components() }, undefined, 1)
    renderer.render(stage)
  }

  const onLost = (): void => {
    lost = true
    paused.set(true)
  }
  // Pixi's own listener was added first, so its GPU state is made again before this draws.
  const onRestored = (): void => {
    lost = false
    paused.set(false)
    render()
  }
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)

  return {
    paused: { subscribe: paused.subscribe },
    show(def, library, motion) {
      drawing?.destroy()
      drawing = undefined
      if (def !== undefined) {
        const factory = figure(def, { library, motion, state: () => state, now: () => time, warn: () => {} })
        const row = { sid: 1, components: components() }
        // The figure view reads its place from the row's `model` component; the library of models is not used.
        drawing = factory(row as never, 'model', {} as never) as unknown as Drawing | undefined
        if (drawing !== undefined) view.root.addChild(drawing.container as never)
      }
      render()
    },
    pose(next, at) {
      state = next
      time = at
      render()
    },
    face(next) {
      yaw = next
      render()
    },
    look(orbit) {
      const { eye } = basis(orbit)
      view.camera.fov = orbit.fov
      view.camera.position.set(eye[0], eye[1], eye[2])
      view.camera.lookAt({ x: orbit.target[0], y: orbit.target[1], z: orbit.target[2] })
      render()
    },
    resize(next) {
      if (destroyed) return
      renderer.resize(next.w, next.h, next.resolution)
      view.width = next.w
      view.height = next.h
      render()
    },
    render,
    destroy() {
      if (destroyed) return
      destroyed = true
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      paused.set(false)
      drawing?.destroy()
      stage.destroy({ children: true })
      renderer.destroy({ removeView: false })
    },
  }
}
