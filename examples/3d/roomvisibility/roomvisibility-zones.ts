// roomvisibility-zones: three rooms and a bulkhead, drawn only as far as the camera's zone sees
//
// Shows: room visibility (`@automata/room-visibility`): a policy names the rooms (sector ids), the rooms each camera
//   zone sees and the rooms that own each mass. A zone change hides what that zone should not see, the zone just left
//   stays a third of a second so the cut does not pop, and a wall with `hideFrom: ['hall']` is cut away from the hall.
//   `?rooms=0` draws every room whatever the zone (the extension off), `?zone=` picks the start, `?pref=webgpu`.
// Controls: 1 hall, 2 corridor, 3 closet, V switches room visibility on and off
// Packages: @automata/framework, @automata/3d, @automata/room-visibility
// Difficulty: ★★★★
// Tier: extension
import '@automata/3d/no-eval'
import {
  buildWorld,
  createPixi3dRenderer,
  DEFAULT_LOOK,
  drawWorld,
  render3dExtension,
  swatchColour,
} from '@automata/3d'
import { baseLibrary } from '@automata/3d/base'
import { readLevel } from '@automata/3d/level'
import { defineGame, definePlugin } from '@automata/framework'
import * as visibility from '@automata/room-visibility'
import * as masks from '@automata/room-visibility/view'

// --- level ---
// Rooms are sectors, and a room may be several (the reception is the hall and the counter). Each has its own floor colour
// so a hidden room is plain to see. Walls are plain except the corridor's west one: the `bulkhead` cutaway group, which
// hides from the `hall` zone.
const room = (id: string, x: number, z: number, w: number, d: number, floor: string, wall = {}) => {
  const plain = { surface: 'baseWall' }
  return {
    id,
    light: 1,
    floor: { z: 0, surface: floor },
    ceiling: { z: 2.7, surface: 'baseCeiling' },
    corners: [
      [x, z, plain],
      [x + w, z, plain],
      [x + w, z + d, plain],
      [x, z + d, { ...plain, ...wall }],
    ],
  }
}
const { level } = readLevel({
  format: 'af-sector/2',
  name: 'zones',
  sectors: [
    room('hall', 0, 0, 4, 4, 'brass'),
    room('counter', 4, 0, 2, 2, 'bark'),
    room('closet', 8, 4, 2, 2, 'trimDark'),
    room('corridor', 8, 0, 4, 4, 'glassDay', { cut: 'bulkhead', hideFrom: ['hall'] }),
  ],
})
const policy = visibility.parseRoomPolicy({
  rooms: { reception: ['hall', 'counter'], corridor: ['corridor'], supply: ['closet'] },
  zones: { hall: ['reception', 'corridor'], corridor: ['corridor'], closet: ['supply'] },
})
const stands = { hall: { x: 2, z: 2 }, corridor: { x: 10, z: 2 }, closet: { x: 9, z: 5 } }
const world = buildWorld(level, baseLibrary, { night: false })
const groups = visibility.wallGroups(level)
const colourOf = (swatch: string) => swatchColour(baseLibrary, swatch)

// --- game ---
const query = new URLSearchParams(location.search)
export default defineGame({
  id: 'roomvisibility-zones',
  size: { width: 480, height: 270 },
  sim: { plugins: [definePlugin({ name: 'empty', defs: [] })], seed: 1 },
  extensions: [render3dExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      preference: query.get('pref') === 'webgpu' ? 'webgpu' : 'webgl',
      look: DEFAULT_LOOK,
      views: {},
      scene: (view, stage) => {
        view.camera.mode = 'orthographic'
        view.camera.orthographicSize = 6.2
        view.camera.position.set(6, 12, 18)
        view.camera.lookAt({ x: 6, y: 0, z: 3.5 })
        view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
        // Each room is drawn into a layer that room owns, and a wall piece goes in its cutaway group as it is drawn.
        const owned = masks.createRoomOwnership(view.root, policy)
        const hider = masks.createWallHider()
        const draw: masks.DrawByRoom<(typeof world.pieces)[number]>['draw'] = (parent, pieces) =>
          drawWorld({ parent, colourOf, look: DEFAULT_LOOK }, pieces)
        masks.drawByRoom({ owned, policy, groups, hider, pieces: world.pieces, draw })
        owned.own(view.camera, 'global')
        owned.assertComplete()
        const rooms = visibility.createRoomVisibility(policy, visibility.plansOf(level))
        let zone = (query.get('zone') ?? 'hall') as keyof typeof stands
        let on = query.get('rooms') !== '0'
        const { dataset } = stage.app.canvas
        const apply = (dt: number): void => {
          const shown = on
            ? rooms.update({ zone, at: stands[zone], dt, reducedMotion: false, cutscene: false })
            : new Set(Object.keys(policy.rooms))
          owned.apply(shown)
          hider.apply(on ? visibility.hiddenWallGroups(groups, zone, false) : new Set())
          dataset.zone = zone
          dataset.rooms = on ? [...shown].sort().join(',') : 'all'
        }
        apply(0)
        setInterval(() => apply(0.016), 16)
        addEventListener('keydown', (event) => {
          zone = ({ 1: 'hall', 2: 'corridor', 3: 'closet' } as Record<string, typeof zone>)[event.key] ?? zone
          if (event.key.toLowerCase() === 'v') on = !on
        })
        return undefined
      },
    }),
})
