// What a fog does to each kind of surface, against what `@pixi/3d` 0.1.0-beta.2 drew: the scene, the colours beta.2 showed, and how to
// read them back, shared by the WebGL2 and the WebGPU cases (`tests/browser/parity/shared/parity/fog-surfaces.test.ts`,
// `tests/browser/webgpu/fog-surfaces.test.ts`). The games' fog numbers were tuned on beta.2, so beta.3 has to show the same
// colour at the same distance on every surface kind, from the same fog colour, near and far.
//
// The expected colours were RECORDED from beta.2 (worktree of `c1c9b7c2`, pixi.js 8.23.0, no post effect in the frame so the 8.23 render-target
// change does not touch it; WebGL2, Chromium, software GL): this same scene, with the unlit colour given the way beta.2's framework gave it
// (pre-decoded, so it showed as written), planes facing the camera at 6, 8, 10 and 14 m under a fog from 4 m to 12 m. They are values to
// match, not to re-record: a change here is a change of picture, and the Owner's.
//
// The surface kinds are the ones the framework draws: an unlit colour (props, embers, a figure's tinted cast), a baked room (an unlit material
// whose vertex colours carry the light and the albedo), a lit surface (`PhongMaterial`) and the stepped-light surface of the look
// (`RampMaterial`). Beta.2 mixed fog into a lit surface in linear light and into an unlit one as a plain mix of display values toward the fog
// colour's decoded value (see `docs/superpowers/audits/2026-11-12-pixi-3d-beta-3/README.md`, "Item 2").
import { DirectionalLight, Mesh3D, PhongMaterial, PlaneGeometry } from '@pixi/3d'
import { createPixi3dRenderer, type Pixi3dRenderer } from '../app/create-renderer.ts'
import { RampMaterial } from '../features/look/ramp-light-material.ts'
import { sceneLightingSchema } from '../shared/render/light/scene-lighting.schema.ts'
import { UnlitMaterial } from '../shared/render/views/unlit-material.ts'
import { builtRenderer } from './built-renderer.ts'
import { snapshot } from './snapshot.ts'
import { testTarget } from './test-target.ts'

export const DISTANCES = [6, 8, 10, 14] as const
export const KINDS = ['unlit', 'baked', 'phong', 'ramp'] as const
export type Kind = (typeof KINDS)[number]
export const FOG_NAMES = ['none', 'light', 'dark'] as const
export type FogName = (typeof FOG_NAMES)[number]

const W = 320
const H = 180
const BASE = 0xa0c0e0
const NEAR = 4
const FAR = 12
const FOGS = { light: 0x8b9bb4, dark: 0x31222a } as const
const lighting = sceneLightingSchema.parse({ ambient: 0.6, colorSpace: 'srgb', lamps: [] })

/** The colours at `DISTANCES`, one `[r, g, b]` each. */
export type Row = readonly (readonly [number, number, number])[]

/** Recorded from beta.2. Keys: `<kind> <fog name>`; `none` is the same plane with no fog. */
export const EXPECTED: Record<string, Row> = {
  'unlit none': [
    [160, 192, 224],
    [160, 192, 224],
    [160, 192, 224],
    [160, 192, 224],
  ],
  'unlit light': [
    [145, 175, 207],
    [113, 138, 170],
    [81, 101, 133],
    [66, 84, 116],
  ],
  'unlit dark': [
    [136, 163, 190],
    [84, 98, 115],
    [32, 33, 40],
    [8, 4, 6],
  ],
  'baked none': [
    [96, 115, 134],
    [96, 115, 134],
    [96, 115, 134],
    [96, 115, 134],
  ],
  'baked light': [
    [91, 110, 132],
    [81, 99, 125],
    [71, 89, 119],
    [66, 84, 116],
  ],
  'baked dark': [
    [82, 98, 114],
    [52, 60, 70],
    [22, 21, 26],
    [8, 4, 6],
  ],
  'phong none': [
    [104, 125, 145],
    [105, 125, 146],
    [105, 125, 146],
    [104, 125, 145],
  ],
  'phong light': [
    [110, 130, 151],
    [123, 140, 163],
    [133, 150, 174],
    [138, 154, 179],
  ],
  'phong dark': [
    [98, 116, 135],
    [84, 95, 110],
    [64, 63, 74],
    [52, 39, 46],
  ],
  'ramp none': [
    [175, 211, 247],
    [175, 211, 247],
    [175, 211, 247],
    [175, 211, 247],
  ],
  'ramp light': [
    [170, 203, 238],
    [158, 185, 216],
    [144, 164, 191],
    [138, 154, 179],
  ],
  'ramp dark': [
    [163, 196, 229],
    [132, 156, 182],
    [87, 96, 112],
    [52, 39, 46],
  ],
}

/**
 * The unlit and baked rows match beta.2 to the digit under every fog, so fog adds no error. The lit rows are within 1 and the stepped-lit
 * ones within 2, with no fog as with: that is the albedo's decode curve (beta.2 piecewise sRGB, beta.3 a 2.2 gamma), the lit colour of item 6.
 */
export const TOLERANCE = 2

/** The planes' angle from the camera's axis, so each stands in its own column. */
const angle = (j: number): number => ((j - 1.5) * 14 * Math.PI) / 180

/** Which of two ways to read the frame back: WebGL2's `readPixels`, or the canvas as it was presented (WebGPU keeps no buffer past the task). */
export type Read = (renderer: Pixi3dRenderer) => ArrayLike<number>

/** One frame of `kind`'s planes at `DISTANCES` under `fogName`, and their colours as `read` gives them. */
export async function shootFog(
  kind: Kind,
  fogName: FogName,
  preference: 'webgl2' | 'webgpu',
  read: Read = snapshot,
  onBuilt?: (renderer: Pixi3dRenderer) => void,
): Promise<Row> {
  const host = document.createElement('div')
  document.body.appendChild(host)
  let fovDeg = 45
  const fog = fogName === 'none' ? undefined : { near: NEAR, far: FAR, color: FOGS[fogName] }
  const factory = createPixi3dRenderer({
    ...(preference === 'webgpu' ? { preference } : {}),
    logicalWidth: W,
    logicalHeight: H,
    backgroundColor: 0x000000,
    views: {},
    lighting,
    fog,
    scene: (view, _stage, _occluders, light) => {
      fovDeg = view.camera.fov
      view.camera.position.set(0, 0, 0)
      view.camera.lookAt({ x: 0, y: 0, z: -1 })
      view.root.addChild(new DirectionalLight({ intensity: 1.2 }))
      DISTANCES.forEach((d, j) => {
        const half = d * Math.tan((3 * Math.PI) / 180)
        const material =
          kind === 'unlit'
            ? new UnlitMaterial({ baseColor: BASE })
            : kind === 'baked'
              ? new UnlitMaterial({ baseColor: 0xffffff })
              : kind === 'phong'
                ? new PhongMaterial({ baseColor: BASE })
                : new RampMaterial({ baseColor: BASE })
        const plane = new Mesh3D({
          geometry: new PlaneGeometry({ width: 2 * half, height: 2 * half }),
          material,
        })
        plane.position.set(d * Math.tan(angle(j)), 0, -d)
        view.root.addChild(plane)
        if (kind === 'baked') light?.bake(plane, { albedo: BASE })
      })
      return undefined
    },
  })
  const renderer = await builtRenderer(factory(testTarget(host)))
  try {
    onBuilt?.(renderer)
    renderer.draw({ alpha: 1, frameMs: 16, paused: false })
    const shot = read(renderer)
    const canvas = renderer.stage.app.canvas as HTMLCanvasElement
    const [cw, ch] = [canvas.width, canvas.height]
    const tanV = Math.tan((fovDeg * Math.PI) / 360)
    const scale = Math.min(cw / W, ch / H)
    return DISTANCES.map((_d, j) => {
      const logical = W / 2 + (Math.tan(angle(j)) / (tanV * (W / H))) * (W / 2)
      const x = Math.round((cw - W * scale) / 2 + logical * scale)
      const i = (Math.round(ch / 2) * cw + x) * 4
      return [shot[i] ?? 0, shot[i + 1] ?? 0, shot[i + 2] ?? 0] as const
    })
  } finally {
    renderer.dispose()
    document.body.replaceChildren()
  }
}

/** The channels of `seen` that are more than `tolerance` from `wanted`, as sentences; none when the row matches. */
export function rowMisses(
  label: string,
  seen: Row,
  wanted: Row | undefined,
  tolerance: number = TOLERANCE,
): string[] {
  if (wanted === undefined) return [`no recorded row for ${label}`]
  const misses: string[] = []
  for (const [j, rgb] of seen.entries())
    for (const [k, c] of rgb.entries()) {
      const want = wanted[j]?.[k] ?? -99
      if (Math.abs(c - want) > tolerance)
        misses.push(`${label} at ${DISTANCES[j]} m, channel ${k}: ${c} against ${want}`)
    }
  return misses
}
