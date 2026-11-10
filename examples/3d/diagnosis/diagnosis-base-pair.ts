// diagnosis-base-pair: the base pair as AF draws it, framed the way the reference builder's render script frames it
//
// Shows: the man (short fade) and the woman (box-braid pony), each from the front and at three-quarters, in four cells
//   of 128 × 192 pixels that show 2.6 m each, the feet 13.5 pixels up, an orthographic camera 18° down: the reference
//   DENSITY=2 cell, so the two can be laid side by side (docs/refactor/2026-11-10-character-kit-diagnosis.md).
//   `?look` draws it in the look as the library ships it (DUEL snap, stepped light, dither; its outline is off);
//   without it, as the character kit's own examples draw. `?own` keeps the pair's core hairstyles. The hairstyles,
//   gaits and swatches are the kit's fixture content, compiled into fixture.json by
//   extensions/character-kit/scripts/dump-fixture.ts.
// Controls: none
// Packages: @automata/framework, @automata/3d, @automata/character-kit
// Difficulty: ★★★☆
// Tier: extension
import '@automata/3d/no-eval'
import { createPixi3dRenderer, DEFAULT_LOOK, figure, render3dExtension } from '@automata/3d'
import { BASE_PAIR, BASE_PAIR_SWATCHES } from '@automata/3d/base'
import type { FigureDef, FigureLibrary, Gait, HairStyle, MotionLibrary, Swatch } from '@automata/3d/figures'
import { figuresExtension } from '@automata/3d/figures'
import { characterKitExtension } from '@automata/character-kit'
import { defineComponent, defineGame, definePlugin } from '@automata/framework'
import fixture from './fixture.json' with { type: 'json' }

// --- figure ---
const content = fixture as unknown as Record<string, Record<string, unknown>>
const kind = <T>(name: string) => (content[name] ?? {}) as Record<string, T>
const hair = kind<HairStyle>('figure-hair')
// The reference's `hairBraid` (ramp 12, base 1): DUEL's mud ramp, step 1.
const library: FigureLibrary = {
  swatches: {
    ...kind<Swatch>('figure-swatch'),
    ...BASE_PAIR_SWATCHES,
    'hair-braid': { ramp: 'mud', step: 1 },
  },
  hair,
  headwear: {},
  items: {},
}
const motion: MotionLibrary = {
  gaits: kind<Gait>('figure-gait'),
  poses: {},
  clips: {},
  items: {},
  stands: {},
  rigs: {},
}

// The pair as the reference builder dresses them: the man in the short fade, the woman in the box-braid pony. The
// turn sheet's relaxed stand, so no library stand.
const { stand: _m, ...man } = BASE_PAIR.man
const { stand: _f, ...woman } = BASE_PAIR.woman
// `?own` keeps the pair's own core hairstyles (the man's cropped locks, the woman's bob) instead of the kit's.
const own = new URLSearchParams(globalThis.location?.search ?? '').has('own')
const styled = (def: FigureDef, style: string, colour: string): FigureDef => ({
  ...def,
  ...(own ? { outfits: def.outfits } : {}),
  ...(own
    ? {}
    : {
        outfits: {
          base: (def.outfits.base ?? []).map((g) => ('hair' in g ? { hair: colour, style: hair[style] } : g)),
        },
      }),
})
const people: Record<string, FigureDef> = {
  'm-front': styled(man, 'short-fade', 'hair-black'),
  'm-three': styled(man, 'short-fade', 'hair-black'),
  'f-front': styled(woman, 'box-braid-pony', 'hair-braid'),
  'f-three': styled(woman, 'box-braid-pony', 'hair-braid'),
}

// --- scene ---
// The reference builder's DENSITY=2 cell: 128 × 192 pixels showing 2.6 m, the feet 13.5 pixels up, the camera 18° down.
const CELL = [128, 192] as const
const PPM = CELL[1] / 2.6
const PITCH = (18 * Math.PI) / 180
const AIM = (CELL[1] / 2 - 13.5) / PPM / Math.cos(PITCH)
const look = new URLSearchParams(globalThis.location?.search ?? '').has('look')

// --- sim ---
const place = { x: 'f32', y: 'f32', z: 'f32', yaw: 'f32' } as const
const kinds = Object.keys(people).map((name) => defineComponent(name, place))
// AF's yaw 0 faces away from a camera on +z, so the front is π; three-quarters turns it an eighth more.
const YAWS = [0, Math.PI / 4, 0, Math.PI / 4]

// --- game ---
export default defineGame({
  id: 'diagnosis-base-pair',
  size: { width: CELL[0] * 4, height: CELL[1] },
  sim: {
    plugins: [definePlugin({ name: 'stand', defs: kinds })],
    seed: 1,
    setup: (sim) => {
      for (const [i, k] of kinds.entries())
        sim.spawn([[k, { x: ((i - 1.5) * CELL[0]) / PPM, y: 0, z: 0, yaw: YAWS[i] ?? 0 }]])
    },
  },
  extensions: [render3dExtension, figuresExtension, characterKitExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      ...(look ? { look: DEFAULT_LOOK } : {}),
      backgroundColor: 0xffffff,
      views: Object.fromEntries(
        kinds.map((k) => [k.id, figure(people[k.id] as FigureDef, { library, motion, now: () => 0 })]),
      ),
      scene: (view) => {
        const d = 20
        view.camera.mode = 'orthographic'
        view.camera.orthographicSize = (CELL[0] * 2) / PPM
        view.camera.position.set(0, AIM + d * Math.sin(PITCH), d * Math.cos(PITCH))
        view.camera.lookAt({ x: 0, y: AIM, z: 0 })
        view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
        return undefined
      },
    }),
})
