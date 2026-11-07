// A built figure drawn in `@pixi/3d` (M3 spec §4.4.1 "Drawing"): each rigid part a `Mesh3D` under its joint's
// `Container3D`, each skinned part a `Mesh3D` on the figure re-skinned on the CPU at each pose step, and the neutral
// face's marks as quads on their bones. The joint containers sit flat under the figure's node and take `fk`'s world
// matrices (figure space), so they are not nested. One material a material name, owned by this figure: the view
// tints them by the room's light, so no two figures share one.
import type { Built, BuiltMaterial, M, Mesh, Skeleton, V3, Weight } from '@automata/figures'
import { Container3D, FlatMaterial, Geometry3D, Mesh3D, PhongMaterial } from '@pixi/3d'
import { materialColour } from './figure-colour.js'
import { decalQuads } from './figure-decals.js'
import { placeJoint } from './figure-joints.js'
import { restInverses, skinPart, type VertexData } from './figure-skin.js'

/** A material of the figure, its drawn colour and whether it keeps that colour in any light. */
export interface FigureMaterial {
  readonly material: FlatMaterial | PhongMaterial
  readonly colour: number
  readonly flat: boolean
}

export interface FigureDrawing {
  /** The figure's node: the joint containers and the skinned parts. */
  readonly node: Container3D
  /** One container per joint, in the rig's joint order. */
  readonly joints: readonly Container3D[]
  /** By material name. */
  readonly materials: ReadonlyMap<string, FigureMaterial>
  /** How many face marks are drawn. */
  readonly decals: number
  /** Moves every joint to `world` (one matrix per joint, figure space) and re-skins the skinned parts. */
  pose(world: readonly M[]): void
  destroy(): void
}

export interface DrawFigureOptions {
  /** The room is lit (`lighting`): every material is flat and the view tints it (M3R-D4); else Phong. */
  readonly lit: boolean
}

interface Skinned {
  readonly rest: VertexData
  readonly weights: readonly (readonly Weight[])[]
  readonly out: VertexData
  readonly geometry: Geometry3D
}

const indicesOf = (indices: readonly number[], vertices: number) =>
  vertices > 0xffff ? Uint32Array.from(indices) : Uint16Array.from(indices)

function geometryOf(mesh: Mesh, dynamic: boolean): Geometry3D {
  return new Geometry3D({
    positions: Float32Array.from(mesh.positions),
    normals: Float32Array.from(mesh.normals),
    indices: indicesOf(mesh.indices, mesh.positions.length / 3),
    quantizeNormals: false,
    dynamic,
  })
}

function materialOf(built: BuiltMaterial, palette: readonly string[], lit: boolean): FigureMaterial {
  const colour = materialColour(built, palette)
  const flat = built.flat === true
  const material =
    flat || lit ? new FlatMaterial({ baseColor: colour }) : new PhongMaterial({ baseColor: colour })
  return { material, colour, flat }
}

/** Draws `built` on `skeleton`'s joints, in `palette`'s colours (`#rrggbb` strings). Pose it before the first frame. */
export function drawFigure(
  built: Built,
  skeleton: Skeleton,
  palette: readonly string[],
  options: DrawFigureOptions,
): FigureDrawing {
  const node = new Container3D()
  const joints = skeleton.rest.map(() => node.addChild(new Container3D()))
  const materials = new Map<string, FigureMaterial>()
  for (const [name, material] of Object.entries(built.materials))
    materials.set(name, materialOf(material, palette, options.lit))
  const materialNamed = (name: string) => {
    const found = materials.get(name)
    if (found === undefined) throw new Error(`the built figure names no material ${name}`)
    return found.material
  }
  const jointAt = (bone: number) => {
    const joint = joints[bone]
    if (joint === undefined) throw new RangeError(`no joint ${bone}`)
    return joint
  }
  const geometries: Geometry3D[] = []
  const skinned: Skinned[] = []
  for (const part of built.parts) {
    if (part.mesh.indices.length === 0) continue
    const geometry = geometryOf(part.mesh, part.skin !== undefined)
    geometries.push(geometry)
    const mesh = new Mesh3D({ geometry, material: materialNamed(part.material) })
    if (part.skin === undefined) {
      jointAt(part.bone ?? 0).addChild(mesh)
      continue
    }
    node.addChild(mesh)
    const attributes = geometry.attributes as Record<string, { buffer: { data: Float32Array } } | undefined>
    const positions = attributes.aPosition?.buffer.data
    const normals = attributes.aNormal?.buffer.data
    if (positions === undefined || normals === undefined)
      throw new Error('a skinned part has no vertex buffers')
    skinned.push({
      rest: {
        positions: Float32Array.from(part.mesh.positions),
        normals: Float32Array.from(part.mesh.normals),
      },
      weights: part.skin,
      out: { positions, normals },
      geometry,
    })
  }
  const quads = decalQuads(built.decals)
  for (const quad of quads) {
    const geometry = new Geometry3D({
      positions: quad.positions,
      normals: quad.normals,
      indices: quad.indices,
      quantizeNormals: false,
    })
    geometries.push(geometry)
    jointAt(quad.bone).addChild(new Mesh3D({ geometry, material: materialNamed(quad.material) }))
  }
  const restInverse: V3[] = restInverses(skeleton.rest)
  return {
    node,
    joints,
    materials,
    decals: quads.length,
    pose(world) {
      for (let i = 0; i < joints.length; i++) {
        const m = world[i]
        if (m === undefined) throw new RangeError(`no world matrix for joint ${i}`)
        placeJoint(jointAt(i), m)
      }
      for (const part of skinned) {
        skinPart(part.rest, part.weights, world, restInverse, part.out)
        part.geometry.attributes.aPosition?.buffer.update()
        part.geometry.attributes.aNormal?.buffer.update()
      }
    },
    destroy() {
      node.destroy({ children: true })
      for (const geometry of geometries) geometry.destroy(true)
      for (const { material } of materials.values()) material.destroy()
    },
  }
}
