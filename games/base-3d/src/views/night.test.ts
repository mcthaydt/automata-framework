// The night scene (art direction spec §2, §4): what `buildNight` puts under the view, built against a bare root and a
// recording stand-in for the occluder stage, so it runs in Node. Lights come from the dressing and stay within the
// budget; the ruin's walls are bays coloured per vertex plus the arch's piers; the sky, fog colour and ambient are the palette's;
// and each frame moves the fireflies without rebuilding anything.
import type { Occluders, WallOptions } from '@mcthaydt/automata-render-pixi3d'
import { Container3D, Mesh3D, ParticleContainer3D, PhongMaterial, PointLight, type View3D } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { ROOM } from '../content/room.ts'
import { dressingOf, LIGHT_BUDGET } from './dressing.ts'
import { buildNight, FOG } from './night.ts'
import { colour } from './palette.ts'

function stage() {
  const root = new Container3D()
  const view = { root, background: undefined as unknown, environment: undefined as unknown }
  const walls: WallOptions[] = []
  const props: Mesh3D[] = []
  const occluders: Occluders = {
    wall(options) {
      walls.push(options)
      const node = new Container3D()
      root.addChild(node)
      return node
    },
    ceiling() {
      throw new Error('the night has no ceilings')
    },
    prop(mesh) {
      props.push(mesh)
    },
    box() {
      throw new Error('the night builds its own boxes')
    },
  }
  const night = buildNight(view as unknown as View3D, occluders, ROOM)
  return { root, view, walls, props, night }
}

const descendants = (node: Container3D): Container3D[] =>
  (node.children as Container3D[]).flatMap((child) => [child, ...descendants(child)])

describe('buildNight', () => {
  it('lights the room from the dressing, inside the budget', () => {
    const { root } = stage()
    const lights = descendants(root).filter((n): n is PointLight => n instanceof PointLight)
    expect(lights).toHaveLength(dressingOf(ROOM).lights.length)
    expect(lights.length).toBeLessThanOrEqual(LIGHT_BUDGET)
    // No light below the platforms: the channels open onto the sky, not lava.
    expect(lights.filter((l) => l.position.y < 0)).toHaveLength(0)
  })

  it('builds the ruin from bays coloured per vertex, the near wall and the arch’s two piers', () => {
    const { walls, props } = stage()
    const dressing = dressingOf(ROOM)
    expect(walls).toHaveLength(dressing.bays.length + 1 + 2)
    for (const wall of walls) expect(wall.paint?.cell).toBeGreaterThan(0)
    // The pillars between bays and the arch's lintel fade when they stand between the camera and Wick.
    expect(props.length).toBeGreaterThan(4)
  })

  it('colours all its stone per vertex, with no painted texture (vertex colour only)', () => {
    const { root } = stage()
    const stone = descendants(root).filter((n): n is Mesh3D => n.label === 'night:stone')
    // Two boxes a room (the top and the island under it), the pillars, the lintel and the plinth.
    expect(stone.length).toBeGreaterThan(2 * ROOM.rooms.length + 4)
    const plain = new PhongMaterial().textures.baseColor
    for (const mesh of stone) {
      const material = mesh.material as PhongMaterial
      expect(material.vertexColors).toBe(true)
      expect(material.textures.baseColor).toBe(plain)
    }
  })

  it('sets the night sky, the moonlit ambient and fog the colour of the haze', () => {
    const { view } = stage()
    // The ruin floats: below the horizon is night sky too, the deep blue of Wick's cloak shade, never teal ground.
    expect(view.background).toMatchObject({ skyColor: colour('skyHigh'), groundColor: colour('skyDeep') })
    // The ambient sky is a saturated blue, so the stone between the lamps keeps Emberwick's blue, not grey.
    expect(view.environment).toMatchObject({ skyColor: colour('ambientSky'), groundColor: colour('skyMid') })
    expect(FOG.color).toBe(colour('skyDeep'))
    expect(FOG.far).toBeGreaterThan(FOG.near)
  })

  it('draws the stone, the channel rims, the mushrooms and the backdrop as meshes, and the glow, motes, grass, vines and shafts as particles', () => {
    const { root } = stage()
    const all = descendants(root)
    expect(all.filter((n) => n instanceof ParticleContainer3D).length).toBeGreaterThanOrEqual(6)
    expect(
      all.filter((n) => n instanceof Mesh3D && !(n instanceof ParticleContainer3D)).length,
    ).toBeGreaterThan(30)
  })

  it('moves the fireflies each frame and changes nothing else', () => {
    const { root, night } = stage()
    const before = descendants(root).length
    const motes = descendants(root).find((n) => n.label === 'night:motes') as ParticleContainer3D
    night.update(1)
    const a = Array.from(motes.data.f32.slice(0, 64))
    night.update(2)
    expect(Array.from(motes.data.f32.slice(0, 64))).not.toEqual(a)
    expect(descendants(root).length).toBe(before)
  })
})
