// lcdpanel-screen: a room seen through an LCD screen, with the panel switched on and off
//
// Shows: the LCD panel look (`@automata/lcd-panel`): a mesh of rows and columns, RGB stripes, scanlines, a little
//   halation round bright pixels and a frame vignette, one pass over the pixel-art look's field. A profile sets it (the
//   defaults are the clinic's numbers; here the mesh is a little stronger so it reads at this size), and the pass is
//   added once, before the renderer is made. `?pref=webgpu` draws on WebGPU, `?lcd=0` starts with the panel off.
// Controls: L switches the panel on and off
// Packages: @automata/framework, @automata/3d, @automata/lcd-panel
// Difficulty: ★★☆☆
// Tier: extension
import '@automata/3d/no-eval'
import {
  buildWorld,
  createPixi3dRenderer,
  DEFAULT_LOOK,
  drawWorld,
  levelTime,
  render3dExtension,
  swatchColour,
  worldLighting,
} from '@automata/3d'
import { BASE_SCENES, baseLibrary } from '@automata/3d/base'
import { defineGame, definePlugin } from '@automata/framework'
import { addLcdPanelPass } from '@automata/lcd-panel/pass'

// --- look ---
const query = new URLSearchParams(location.search)
const panel = addLcdPanelPass({ enabled: query.get('lcd') !== '0', profile: { grid: 0.45, subpixels: 0.4 } })

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
  id: 'lcdpanel-screen',
  size,
  sim: { plugins: [definePlugin({ name: 'empty', defs: [] })], seed: 1 },
  extensions: [render3dExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
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
        dataset.panel = panel.passes.length > 0 ? 'ready' : 'missing'
        const set = (): void => {
          dataset.lcd = String(panel.passes.at(-1)?.enabled)
        }
        set()
        addEventListener('keydown', (event) => {
          if (event.key.toLowerCase() !== 'l') return
          const pass = panel.passes.at(-1)
          if (pass) pass.enabled = !pass.enabled
          set()
        })
        return undefined
      },
    }),
})
