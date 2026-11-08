// world-level-room: a room built from a level file and drawn in the pixel-art look, with Wick standing in it
//
// Shows: a room as data (an af-sector level: one sector with its floor, walls and ceiling named by swatch, as the level
//   editor writes it) that `buildWorld` turns into pieces and `drawWorld` puts in the scene, each swatch a DUEL ramp
//   and step; the walls and ceiling between the camera and Wick are the occluders' to cut away. (A time of day is not
//   here: core reads it only through the passes an extension registers.)
// Controls: none
// Packages: @automata/framework, @automata/3d
// Difficulty: ★★★☆
// Tier: core
import '@automata/3d/no-eval'
import {
  buildWorld,
  createPixi3dRenderer,
  DEFAULT_LOOK,
  drawWorld,
  figure,
  render3dExtension,
  swatchColour,
  targetSize,
  type WorldLibrary,
} from '@automata/3d'
import type { FigureDef, FigureLibrary, Gait, Swatch } from '@automata/3d/figures'
import { readLevel } from '@automata/3d/level'
import { defineComponent, defineGame, definePlugin } from '@automata/framework'

// --- figure ---
// A game writes these in content/figures/wick.toml, content/figure-swatches/*.toml and content/figure-gaits/*.toml
// and the content compiler checks them and fills their defaults; here they are inline, written as compiled.
// Swatch colours are DUEL ramps and steps; sole, lid, brow and mouth are the defaults a boot and a face name.
const duel = (ramp: Swatch['ramp'], step: number, more = {}): Swatch => ({ ramp, step, ...more })
const cloak = { 'wick-cloak': duel('ocean', 3), 'wick-cloak-shade': duel('ocean', 1) }
const trim = { 'wick-trim': duel('flame', 5, { gloss: 0.9 }), 'wick-boot': duel('brick', 0) }
const shade = { 'wick-shadow': duel('plum', 0, { flat: true }), 'wick-eye': duel('flame', 7, { flat: true }) }
const face = { sole: duel('plum', 0, { flat: true }), lid: duel('grey', 5, { flat: true }) }
const brows = { brow: duel('brick', 0, { flat: true }), mouth: duel('skin', 0, { flat: true }) }
const swatches = { ...cloak, ...trim, ...shade, ...face, ...brows }
const library: FigureLibrary = { swatches, hair: {}, headwear: {}, items: {} }

// The `bounce` gait, grouped by what each part moves.
const stride = { cycle: 0.46, speed: 3, stride: 0.6, duty: 0.54, lift: 0.065, bob: 0.05, crouch: 0.01 }
const hips = { sway: 0.03, hipYaw: 0.09, hipRoll: 0.08, chestCounter: 0.5, lean: 0.03 }
// The feet's heel and push walking; standOut and standElbow (how the arms hang standing) ride along.
const feet = { heel: 0.24, push: 0.35, standOut: 0, standElbow: 0.36 }
const arms = { armSwing: 0.5, armOut: 0.08, elbow: 0.45, elbowSwing: 0.45, armLag: 0.04, shoulderRoll: 0.75 }
const head = { headLevel: 0, headStabilize: 0.8, drag: 0, track: 0.3, spring: 0.6, chin: 0.04 }
const stand = { stance: 0.045, stanceLead: 0.07, hang: 0.04, idleElbow: 0.3, reach: 1.4 }
const clock = { poseRate: 12, walkPoses: 8, idlePoses: 8, turnRate: 0.785, twitch: 0, twitchEvery: 3 }
const breath = { breath: 0.03, breathPeriod: 3.4, shift: 0.012, shiftPeriod: 5.5, headLead: 0.785 }
const bounce: Gait = { ...stride, ...hips, ...feet, ...arms, ...head, ...stand, ...clock, ...breath }
const motion = { gaits: { bounce }, poses: {}, clips: {}, items: library.items, stands: {}, rigs: {} }

// Wick, Emberwick's hero: a cloak with gold cuffs, a cape, boots and eyes glowing under the hood's shadow.
const outfits = {
  wanderer: [
    { top: 'wick-cloak', sleeves: 'long', cuffs: 'wick-trim' },
    { trousers: 'wick-cloak-shade' },
    { shoes: 'wick-boot', boots: true, sole: 'sole' },
    { cape: 'wick-cloak', length: 0.9, trim: 'wick-trim' },
    { eyes: 'wick-eye', lids: 'lid', brows: 'brow', mouth: 'mouth' },
  ],
} as const
const body = { skin: 'wick-shadow', gait: 'bounce', hand: 'R', default: 'wanderer', outfits } as const
const average = { height: 120, head: 1, chunk: 1, frame: 0.4, legs: 0.2, posture: 0.6, hands: 0.6, feet: 0.6 }

const wick: FigureDef = { ...body, sliders: average }

// --- level ---
// A game writes this as content/levels/<room>.af-sector.json and its swatches in content/world-swatches/*.toml; here
// they are inline. Colours are DUEL ramps and steps.
const world: WorldLibrary = {
  swatches: {
    floor: { ramp: 'dusk', step: 4 },
    wall: { ramp: 'dusk', step: 1 },
    ceiling: { ramp: 'dusk', step: 0 },
  },
}
const room = {
  format: 'af-sector/2',
  name: 'hall',
  sectors: [
    {
      id: 'hall',
      ceiling: 3,
      corners: [
        [-4, -3],
        [4, -3],
        [4, 3],
        [-4, 3],
      ],
      floorTexture: 'floor',
      ceilingTexture: 'ceiling',
      wallTexture: 'wall',
    },
  ],
}

// --- sim ---
// Wick stands in the middle of the hall.
const Hero = defineComponent('hero', { x: 'f32', y: 'f32', z: 'f32', yaw: 'f32' })
const standing = definePlugin({ name: 'standing', defs: [Hero] })

// --- game ---
export default defineGame({
  id: 'world-level-room',
  size: targetSize({ width: 844, height: 390 }, DEFAULT_LOOK.pixel.short),
  sim: {
    plugins: [standing],
    seed: 1,
    setup: (sim) => void sim.spawn([[Hero, { x: 0, y: 0, z: 0, yaw: 0.4 }]]),
  },
  extensions: [render3dExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      look: DEFAULT_LOOK,
      views: { [Hero.id]: figure(wick, { library, motion }) },
      scene: (view, _stage, occluders) => {
        view.camera.position.set(0, 1.7, 5)
        view.camera.lookAt({ x: 0, y: 0.8, z: 0 })
        view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
        const colourOf = (swatch: string) => swatchColour(world, swatch)
        drawWorld(
          { parent: view.root, occluders, colourOf, look: DEFAULT_LOOK },
          buildWorld(readLevel(room).level, world).pieces,
        )
        return undefined
      },
    }),
})
