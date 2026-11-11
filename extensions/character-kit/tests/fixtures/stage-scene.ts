// A 3D renderer with painted figures and flat boxes, drawn on a real GPU, for the browser tests: figures at places, the
// camera the test chooses, a readback of the canvas, and `compose` (the builder's CPU reference) of what the stage placed.
// The figures' `now` is fixed, so a frame is the same frame each run.
import '@automata/3d/no-eval'
import { createPixi3dRenderer, type Pixi3dRenderer } from '@automata/3d'
import { builtRenderer, snapshot, testTarget } from '@automata/3d/testing-checks'
import { CubeGeometry, FlatMaterial, Mesh3D, type View3D } from '@pixi/3d'
import { type PaintedStage, stageFor } from '#src/features/painted/painted-stage.ts'
import { type PaintedFigureOptions, paintedFigure } from '#src/features/painted/painted-view.ts'
import { poseOf } from '#src/features/painted/pose.ts'
import {
  type Backdrop,
  type CameraPose,
  type CharacterDef,
  compose,
  STAGE_VERSION,
  type StageFrame,
  TIE_BIAS,
  texelDepths,
} from '#src/shared/figure-builder/door.ts'

type Step = Parameters<Pixi3dRenderer['apply']>[0]
export const step = (render: Step['render']): Step => ({ tick: 0, events: [], render, rejected: [] })

/** The painter's own scale: a D2 cell shows 2.6 m in 192 texels, so a whole zoom of 2. */
export const PAINTER_PPM = 192 / 2.6
/** `fovOf(24)`: the 24 mm lens, vertical. */
export const LENS_FOV = 53.13010235415598
export const DEG = Math.PI / 180

export interface FigureAt {
  readonly def: CharacterDef
  /** Floor x and z, metres. */
  readonly at: readonly [number, number]
  /** The entity's yaw; 0 faces −z. Default: facing the camera on +z (π). */
  readonly yaw?: number
  readonly options?: PaintedFigureOptions
}

export interface BoxAt {
  readonly size: readonly [number, number, number]
  /** The centre of the base. */
  readonly at: readonly [number, number, number]
  readonly color: number
}

export interface SceneOptions {
  readonly size: readonly [number, number]
  /** `ortho`: the painter's own projection at 18°, 73.846 px a metre. `follow`: the follow rig's view, 5 m back, 25° down. */
  readonly camera: 'ortho' | 'follow'
  readonly figures: readonly FigureAt[]
  readonly boxes?: readonly BoxAt[]
  /** Where the camera looks (x, z); the point is 1 m above the floor. */
  readonly look?: readonly [number, number]
  readonly preference?: 'webgpu'
}

export interface StageScene {
  readonly renderer: Pixi3dRenderer
  readonly view: View3D
  readonly stage: PaintedStage
  readonly size: readonly [number, number]
  /** Draws a frame and reads the canvas back in the same task: RGBA, top row first. */
  draw(): Uint8ClampedArray | Uint8Array
  /** What the stage placed in the last frame, as the builder's own frame. */
  frame(): StageFrame
  dispose(): void
}

/** Points the view's camera at (x, 1, z): `distance` back along `pitchDeg` down, on +z. */
export function aim(
  view: View3D,
  size: readonly [number, number],
  mode: SceneOptions['camera'],
  x: number,
  z: number,
) {
  const camera = view.camera
  const pitch = (mode === 'ortho' ? 18 : 25) * DEG
  const distance = mode === 'ortho' ? 20 : 5
  if (mode === 'ortho') {
    camera.mode = 'orthographic'
    camera.orthographicSize = size[0] / 2 / PAINTER_PPM
  } else {
    camera.mode = 'perspective'
    camera.fov = LENS_FOV
  }
  camera.position.set(x, 1 + distance * Math.sin(pitch), z + distance * Math.cos(pitch))
  camera.lookAt({ x, y: 1, z })
}

/** The pose the stage reads off the view's camera, for a test that computes what it should be. */
export function poseNow(view: View3D, size: readonly [number, number]): CameraPose {
  return poseOf(view.camera, size)
}

export async function buildScene(options: SceneOptions): Promise<StageScene> {
  const [w, h] = options.size
  const host = document.createElement('div')
  document.body.appendChild(host)
  const views: Record<string, ReturnType<typeof paintedFigure>> = {}
  options.figures.forEach((figure, i) => {
    views[`fig${i}`] = paintedFigure(figure.def, { now: () => 0, ...figure.options })
  })
  let seen: View3D | undefined
  const factory = createPixi3dRenderer({
    logicalWidth: w,
    logicalHeight: h,
    backgroundColor: 0xffffff,
    // The letterbox's bars would cover the top and bottom of the field, and a test reads every row of it.
    barFraction: 0,
    ...(options.preference ? { preference: options.preference } : {}),
    views,
    scene: (view) => {
      seen = view
      aim(view, options.size, options.camera, options.look?.[0] ?? 0, options.look?.[1] ?? 0)
      for (const box of options.boxes ?? []) {
        const mesh = new Mesh3D({
          geometry: new CubeGeometry({ width: box.size[0], height: box.size[1], depth: box.size[2] }),
          material: new FlatMaterial({ baseColor: box.color }),
        })
        mesh.position.set(box.at[0], box.at[1] + box.size[1] / 2, box.at[2])
        view.root.addChild(mesh)
      }
      return undefined
    },
  })
  const renderer = await builtRenderer(factory(testTarget(host, {}, { width: w, height: h })))
  const view = seen as View3D
  try {
    const rows = options.figures.map((figure, i) => ({
      sid: i + 1,
      components: { [`fig${i}`]: { x: figure.at[0], y: 0, z: figure.at[1], yaw: figure.yaw ?? Math.PI } },
    }))
    renderer.apply(step({ resync: true, added: rows, changed: [], removed: [] }))
  } catch (error) {
    renderer.dispose()
    document.body.replaceChildren()
    throw error
  }
  const stage = stageFor(view.camera)
  return {
    renderer,
    view,
    stage,
    size: options.size,
    draw() {
      renderer.draw({ alpha: 1, frameMs: 16, paused: false })
      return snapshot(renderer)
    },
    frame() {
      return {
        version: STAGE_VERSION,
        camera: poseNow(view, options.size),
        sprites: stage.placed.map((placed) => placed.sprite),
      }
    },
    dispose() {
      renderer.dispose()
      document.body.replaceChildren()
    },
  }
}

/** A flat face the GPU draws: the plane `z = zFront` between `x0`..`x1` and `y0`..`y1`, as a `Backdrop` of the colour
 * read back from the render, whose depth is where the camera's ray meets the plane. */
export function planeBackdrop(
  pose: CameraPose,
  zFront: number,
  rect: { x0: number; x1: number; y0: number; y1: number },
  rgba: readonly [number, number, number, number],
): Backdrop {
  const [w, h] = pose.size
  return (px: number, py: number) => {
    const origin: [number, number, number] = [...pose.eye]
    let dir: [number, number, number] = [...pose.fwd]
    if (pose.f !== undefined) {
      const sx = (px - (pose.cx ?? w / 2)) / pose.f
      const sy = (py - (pose.cy ?? h / 2)) / pose.f
      dir = [0, 1, 2].map((c) => (pose.fwd[c] ?? 0) + sx * (pose.right[c] ?? 0) - sy * (pose.up[c] ?? 0)) as [
        number,
        number,
        number,
      ]
    } else {
      const ppm = pose.pixelsPerMetre ?? 1
      for (const c of [0, 1, 2]) {
        origin[c] =
          (pose.eye[c] ?? 0) +
          ((px - w / 2) / ppm) * (pose.right[c] ?? 0) -
          ((py - h / 2) / ppm) * (pose.up[c] ?? 0)
      }
    }
    const t = (zFront - (origin[2] ?? 0)) / (dir[2] ?? 1)
    if (!(t > 0)) return null
    const hit = [0, 1, 2].map((c) => (origin[c] ?? 0) + t * (dir[c] ?? 0))
    if (
      (hit[0] ?? 0) < rect.x0 ||
      (hit[0] ?? 0) > rect.x1 ||
      (hit[1] ?? 0) < rect.y0 ||
      (hit[1] ?? 0) > rect.y1
    )
      return null
    const depth = [0, 1, 2].reduce(
      (sum, c) => sum + ((hit[c] ?? 0) - (pose.eye[c] ?? 0)) * (pose.fwd[c] ?? 0),
      0,
    )
    return { depth, rgba }
  }
}

/** The composed frame as the canvas holds it: transparent where the reference has nothing is the white background. */
export function expectedPixels(frame: StageFrame, backdrop?: Backdrop): Uint8ClampedArray {
  const composed = compose(frame, backdrop)
  for (let i = 0; i < composed.length; i += 4) {
    if (composed[i + 3] === 0) composed.set([255, 255, 255, 255], i)
  }
  return composed
}

/** How many pixels differ (any of r, g, b), and the first, skipping those `skip` names. */
export function differing(
  got: ArrayLike<number>,
  want: ArrayLike<number>,
  width: number,
  skip: (x: number, y: number) => boolean = () => false,
): { wrong: number; first: string } {
  let wrong = 0
  let first = ''
  for (let i = 0; i < want.length / 4; i++) {
    const x = i % width
    const y = Math.floor(i / width)
    if (skip(x, y)) continue
    if ([0, 1, 2].some((c) => got[i * 4 + c] !== want[i * 4 + c])) {
      wrong++
      if (!first)
        first = `(${x}, ${y}) want ${[0, 1, 2].map((c) => want[i * 4 + c])} got ${[0, 1, 2].map((c) => got[i * 4 + c])}`
    }
  }
  return { wrong, first }
}

/** The depth buffer's step under the ortho fixture's camera (20 m back, near and far fitted to the figures): a tenth of a millimetre,
 * far above what the GPU's 24 bits resolve there and far below the tie rule's millimetre. */
export const DEPTH_STEP = 1e-4

/**
 * The pixels where two sprites' surfaces cross: where two sprites both paint a texel and their test depths (`texelDepths` less the
 * rank's `(rank + 1) · TIE_BIAS`, the numbers `compose` and the GPU compare) are within `step` of each other. The builder's contract
 * (docs/contract.md, section 4b) lets exactly those differ by a pixel between a GPU and the CPU reference; nothing else may, so a
 * test skips only these and requires every other pixel equal.
 */
export function crossings(
  frame: StageFrame,
  step = DEPTH_STEP,
): { skip(x: number, y: number): boolean; count: number } {
  const [width, height] = frame.camera.size
  const tests = frame.sprites.map((sprite, rank) => {
    const depths = texelDepths(frame.camera, sprite)
    const [w, h] = sprite.cell.size
    const [sx, sy] = sprite.screen
    const out = new Float32Array(width * height).fill(Infinity)
    for (let y = 0; y < height; y++) {
      const v = Math.floor((y + 0.5 - sy) / sprite.scale)
      if (v < 0 || v >= h) continue
      for (let x = 0; x < width; x++) {
        const u = Math.floor((x + 0.5 - sx) / sprite.scale)
        if (u < 0 || u >= w) continue
        const texel = v * w + u
        if (sprite.cell.rgba[texel * 4 + 3])
          out[y * width + x] = Math.fround((depths[texel] ?? Infinity) - (rank + 1) * TIE_BIAS)
      }
    }
    return out
  })
  const near = new Uint8Array(width * height)
  let count = 0
  for (let i = 0; i < width * height; i++) {
    const seen = tests
      .map((t) => t[i] ?? Infinity)
      .filter(Number.isFinite)
      .sort((a, b) => a - b)
    if (seen.length >= 2 && (seen[1] as number) - (seen[0] as number) <= step) {
      near[i] = 1
      count++
    }
  }
  return { skip: (x, y) => near[y * width + x] === 1, count }
}
