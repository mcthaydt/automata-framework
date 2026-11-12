// retrocrisp-grade: a room graded and faded like old film, with the retro pass on and off
//
// Shows: the retro look (`@automataframework/retro-crisp`): the clinic's cold green grade, an unsharp mask, a vignette, and a film
//   fade (black lifted toward a tint, moving grain, dust and a scratch). The pass runs before core's DUEL snap, so its
//   colours are snapped to the palette, and a `RETRO_NEUTRAL` profile changes no colour at all. The crisp half: the field drawn at a whole number of device pixels
//   (core's letterbox `scale: 'whole'`, on by default; `?scale=fit` is the fractional fit to compare) and the LCD panel's
//   colour split snapped to whole pixels (`?crisp=lcd`). `?pref=webgpu` draws on WebGPU, `?retro=0` starts with the pass off.
// Controls: R switches the retro pass on and off
// Packages: @automataframework/framework, @automataframework/3d, @automataframework/retro-crisp, @automataframework/lcd-panel
// Difficulty: ★★★☆
// Tier: extension
import '@automataframework/3d/no-eval'
import {
  buildWorld,
  createPixi3dRenderer,
  DEFAULT_LOOK,
  drawWorld,
  levelTime,
  render3dExtension,
  swatchColour,
  worldLighting,
} from '@automataframework/3d'
import { BASE_SCENES, baseLibrary } from '@automataframework/3d/base'
import { defineGame, definePlugin } from '@automataframework/framework'
import { addLcdPanelPass } from '@automataframework/lcd-panel/pass'
import { crispFromQuery, crispRendererOptions } from '@automataframework/retro-crisp'
import { addRetroPass } from '@automataframework/retro-crisp/pass'

// --- look ---
// The retro pass runs before the snap, the panel after it, whatever order they are added in.
const query = new URLSearchParams(location.search)
const crisp = crispFromQuery(location.search)
const retro = addRetroPass({ enabled: query.get('retro') !== '0' })
addLcdPanelPass({ profile: { snap: crisp.lcd } })

// --- level ---
const level = BASE_SCENES['base-interior']
const time = levelTime(level.time)
const world = buildWorld(level, baseLibrary, { night: time.name !== 'day' })
const diorama = (level.views?.diorama ?? {}) as {
  at?: [number, number, number]
  pitch?: number
  w?: number
  h?: number
}
const size = { width: diorama.w ?? 512, height: diorama.h ?? 320 }

// --- game ---
export default defineGame({
  id: 'retrocrisp-grade',
  size,
  sim: { plugins: [definePlugin({ name: 'empty', defs: [] })], seed: 1 },
  extensions: [render3dExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      ...crispRendererOptions(crisp),
      preference: query.get('pref') === 'webgpu' ? 'webgpu' : 'webgl',
      look: DEFAULT_LOOK,
      time,
      lighting: worldLighting(world, time),
      views: {},
      scene: (view, stage, occluders, light) => {
        const [x, y, z] = diorama.at ?? [0, 1, 0]
        const pitch = ((diorama.pitch ?? 18) * Math.PI) / 180
        view.camera.mode = 'orthographic'
        view.camera.orthographicSize = size.width / 2 / ((96 / 2.6) * 2)
        view.camera.position.set(x, y + Math.sin(pitch) * 40, z + Math.cos(pitch) * 40)
        view.camera.lookAt({ x, y, z })
        view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
        drawWorld(
          {
            parent: view.root,
            occluders,
            colourOf: (s: string) => swatchColour(baseLibrary, s),
            look: DEFAULT_LOOK,
            light,
          },
          world.pieces,
        )
        const { dataset } = stage.app.canvas
        const set = (): void => {
          dataset.retro = String(retro.passes.at(-1)?.enabled)
        }
        set()
        addEventListener('keydown', (event) => {
          if (event.key.toLowerCase() !== 'r') return
          const pass = retro.passes.at(-1)
          if (pass) pass.enabled = !pass.enabled
          set()
        })
        return undefined
      },
    }),
})
