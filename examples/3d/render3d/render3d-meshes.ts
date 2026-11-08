// render3d-meshes: lit boxes and model files in a 3D view
//
// Shows: createPixi3dRenderer mounts a View3D under the game; box() draws a lit box and mesh() a static model
//   (a .glb, and the same prop packed as .bin) at each entity's x, y and z in metres, turned by yaw and
//   interpolated between ticks. Model files load before the first frame through preload, with byte progress; a
//   skinned or damaged one stops boot with a panel naming the file.
// Controls: none
// Packages: @mcthaydt/automata, @mcthaydt/automata-render-pixi3d
// Difficulty: ★★☆☆
// Tier: core
import '@mcthaydt/automata-render-pixi3d/no-eval'
import { defineComponent, defineGame, definePlugin, defineSystem } from '@mcthaydt/automata'
import { box, createPixi3dRenderer, mesh, render3dExtension } from '@mcthaydt/automata-render-pixi3d'

// The same nightstand twice: The Last Light's GLB and its packed .bin (resources/models/PROVENANCE.md).
const glb = new URL('../resources/models/nightstand.glb', import.meta.url).href
const bin = new URL('../resources/models/nightstand.bin', import.meta.url).href

// Positions in metres on the floor (y up); yaw in radians about +y.
const Crate = defineComponent('crate', { x: 'f32', y: 'f32', z: 'f32', yaw: 'f32' })
const Stand = defineComponent('stand', { x: 'f32', y: 'f32', z: 'f32', yaw: 'f32' })
const Packed = defineComponent('packed', { x: 'f32', y: 'f32', z: 'f32', yaw: 'f32' })

// The crate slides across the front and back, spinning; the two nightstands turn in place. Each moves a little a
// tick, and the views draw the blend of the last two ticks.
const turn = defineSystem('turn', (ctx) => {
  const offset = (ctx.tick % 160) / 40 // 0 to 4 metres along the slide, then again
  for (const crate of ctx.query(Crate))
    crate.set(Crate, { x: offset < 2 ? offset - 1 : 3 - offset, yaw: crate.get(Crate).yaw + 0.03 })
  for (const kind of [Stand, Packed])
    for (const stand of ctx.query(kind)) stand.set(kind, { yaw: stand.get(kind).yaw + 0.02 })
})

const room = definePlugin({ name: 'room', defs: [Crate, Stand, Packed, turn] })

export default defineGame({
  id: 'render3d-meshes',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [room],
    seed: 1,
    setup: (sim) => {
      sim.spawn([[Crate, { x: -1, y: 0, z: 0.6, yaw: 0 }]])
      sim.spawn([[Stand, { x: -1.4, y: 0, z: -0.6, yaw: 0 }]])
      sim.spawn([[Packed, { x: 1.4, y: 0, z: -0.6, yaw: 0 }]])
    },
  },
  extensions: [render3dExtension],
  // The runtime fetches the model files before the title, with byte progress and the 30 s stall rule.
  preload: [glb, bin],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      backgroundColor: 0xc7dcd0, // the sky behind the meshes: the light's sky colour
      views: {
        [Crate.id]: box({ width: 0.6, height: 0.6, depth: 0.6 }, { color: 0xf9c22b }),
        [Stand.id]: mesh(glb, { height: 0.8 }),
        [Packed.id]: mesh(bin, { height: 0.8 }),
      },
      // The camera and a sky-and-ground light, set once before the first frame (the angled camera rig and baked
      // lamps arrive with M3.4b and M3.4d).
      scene: (view) => {
        view.environment = { skyColor: 0xc7dcd0, groundColor: 0x3e3546 }
        view.camera.position.set(0, 2.4, 4.2)
        view.camera.lookAt({ x: 0, y: 0.4, z: 0 })
        return undefined
      },
    }),
})
