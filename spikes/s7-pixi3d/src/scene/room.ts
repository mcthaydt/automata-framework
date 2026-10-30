// The S7 room (spike, M3.1a): a 12 × 10 m box with a floor, the far wall and both side walls. The near wall and
// the ceiling are left out, as the angled camera's occluder rule would cut them (M3 spec §4.2), and one static
// GLB prop stands in a corner. Endesga 64 colours.

import { type Container3D, CubeGeometry, Geometry3D, Mesh3D, PhongMaterial, PlaneGeometry } from '@pixi/3d'
import { Texture } from 'pixi.js'
import { parseGlb } from './glb.ts'

export const ROOM = { width: 12, depth: 10, height: 3 } as const

export function buildRoom(root: Container3D): void {
  const floor = new Mesh3D({
    geometry: new PlaneGeometry({ width: ROOM.width, height: ROOM.depth }),
    material: new PhongMaterial({ baseColor: 0x8b6d9c, shininess: 4 }),
  })
  floor.rotation.set(-Math.PI / 2, 0, 0)
  root.addChild(floor)
  const wallMaterial = new PhongMaterial({ baseColor: 0xc7dcd0, shininess: 2 })
  const wall = (width: number, depth: number, x: number, z: number) => {
    const mesh = new Mesh3D({
      geometry: new CubeGeometry({ width, height: ROOM.height, depth }),
      material: wallMaterial,
    })
    mesh.position.set(x, ROOM.height / 2, z)
    root.addChild(mesh)
  }
  wall(ROOM.width, 0.2, 0, ROOM.depth / 2)
  wall(0.2, ROOM.depth, -ROOM.width / 2, 0)
  wall(0.2, ROOM.depth, ROOM.width / 2, 0)
}

/** Loads the GLB, builds its one textured mesh and stands it on the floor `height` metres tall. */
export async function buildProp(
  root: Container3D,
  url: string,
  at: { x: number; z: number },
  height: number,
): Promise<Mesh3D> {
  const bytes = await (await fetch(url)).arrayBuffer()
  const source = parseGlb(bytes)
  const bitmap = await createImageBitmap(new Blob([source.image as BlobPart], { type: source.mime }))
  const k = height / (source.max[1] - source.min[1])
  const mesh = new Mesh3D({
    geometry: new Geometry3D({
      positions: source.positions,
      normals: source.normals,
      uvs: source.uvs,
      indices: source.indices,
    }),
    material: new PhongMaterial({ baseColorTexture: Texture.from(bitmap), shininess: 4 }),
  })
  mesh.scale.set(k, k, k)
  mesh.position.set(at.x, -source.min[1] * k, at.z)
  root.addChild(mesh)
  return mesh
}
