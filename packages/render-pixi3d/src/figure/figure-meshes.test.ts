import { DEFAULT_PALETTE } from '@automataframework/automata-content'
import { build, fk, type M, restPose, skeleton } from '@automataframework/automata-figures'
import { fixtureFigures } from '@automataframework/automata-figures/testing'
import { Container3D, FlatMaterial, Mesh3D, PhongMaterial } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { drawFigure } from './figure-meshes.js'

async function wick() {
  const { figures, library } = await fixtureFigures()
  const def = figures.wick
  if (def === undefined) throw new Error('no wick')
  const s = skeleton(def)
  return { s, built: build(def, s, def.default, 'hand-lamp', library) }
}

const positionsOf = (mesh: Mesh3D) =>
  Float32Array.from(
    (mesh.geometry.attributes as Record<string, { buffer: { data: Float32Array } }>).aPosition?.buffer.data ??
      [],
  )

describe('drawFigure', () => {
  it('draws each rigid part under its joint, the skinned parts on the figure, and the face marks on their bones', async () => {
    const { s, built } = await wick()
    const drawing = drawFigure(built, s, DEFAULT_PALETTE.colors, { lit: false })
    expect(drawing.joints.length).toBe(s.rest.length)
    const rigid = built.parts.filter((p) => p.skin === undefined)
    const skinned = built.parts.filter((p) => p.skin !== undefined)
    const underJoints = drawing.joints.flatMap((joint) => joint.children.filter((c) => c instanceof Mesh3D))
    const onFigure = drawing.node.children.filter((c) => c instanceof Mesh3D)
    // Every rigid part (and any neutral face mark) on a joint, every skinned part on the figure.
    expect(underJoints.length).toBe(rigid.length + drawing.decals)
    expect(onFigure.length).toBe(skinned.length)
    for (const joint of drawing.joints) expect(joint).toBeInstanceOf(Container3D)
    // One material a name, Phong without lighting.
    expect(drawing.materials.size).toBe(Object.keys(built.materials).length)
    for (const { material, flat } of drawing.materials.values())
      expect(material).toBeInstanceOf(flat ? FlatMaterial : PhongMaterial)
    drawing.destroy()
  })

  it('moves the joints to the pose and re-skins the skinned parts on the CPU', async () => {
    const { s, built } = await wick()
    const drawing = drawFigure(built, s, DEFAULT_PALETTE.colors, { lit: true })
    const rest = fk(s, restPose())
    drawing.pose(rest)
    const skinnedMesh = drawing.node.children.find((c) => c instanceof Mesh3D) as Mesh3D
    const atRest = positionsOf(skinnedMesh)
    // The whole figure lifted 1 m: every joint and every skinned vertex rises 1 m.
    const lifted: M[] = rest.map((m) => [...m.slice(0, 9), m[9], m[10] + 1, m[11]] as M)
    drawing.pose(lifted)
    const pelvis = drawing.joints[1]
    expect(pelvis?.position.y).toBeCloseTo((rest[1]?.[10] ?? 0) + 1)
    const moved = positionsOf(skinnedMesh)
    for (let i = 1; i < moved.length; i += 3) expect(moved[i]).toBeCloseTo((atRest[i] ?? 0) + 1, 4)
    // Lit, every material is flat: the light is the view's tint (M3R-D4).
    for (const { material } of drawing.materials.values()) expect(material).toBeInstanceOf(FlatMaterial)
    drawing.destroy()
    expect(drawing.node.destroyed).toBe(true)
  })

  it('draws the neutral face of a figure that has one as quads on the head', async () => {
    const { figures, library } = await fixtureFigures()
    const keeper = figures.keeper
    if (keeper === undefined) throw new Error('no keeper')
    const s = skeleton(keeper)
    const drawing = drawFigure(build(keeper, s, 'lamplighter', null, library), s, DEFAULT_PALETTE.colors, {
      lit: false,
    })
    // The two open eyes (their `when` names neutral) and the three marks with no face state.
    expect(drawing.decals).toBe(5)
    drawing.pose(fk(s, restPose()))
    drawing.destroy()
  })
})
