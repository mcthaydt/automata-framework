// Draws a level's world (features/world/build.ts) with `@pixi/3d`: one mesh per piece under a node, a swatch's colour on
// each, and the camera's occluder rule on the walls and the ceilings. It lives in `app/` because it reads the world's
// pieces and the renderer's occluders; the builder itself knows no renderer. Presentation only: the sim never reads it.
import { Box, Container3D, Geometry3D, Mesh3D, PhongMaterial, Vector3 } from '@pixi/3d'
import type { Occluders } from '../features/camera/occluders/occluders.ts'
import type { WorldPiece } from '../features/world/build.ts'
import { tileName } from '../features/world/surface.ts'

export interface WorldScene {
  /** Where the pieces are added. */
  readonly parent: Container3D
  /** Walls follow the wall rule and ceilings are never drawn in the angled view. Without it every piece just draws. */
  readonly occluders?: Occluders | undefined
  /** A swatch's colour (DUEL, `0xRRGGBB`). A name it does not know is drawn in `fallback`. */
  readonly colourOf: (swatch: string) => number | undefined
  /** Default: mid grey. */
  readonly fallback?: number | undefined
}

export interface WorldView {
  /** Holds every piece's mesh. */
  readonly node: Container3D
  /** A piece's mesh by its id. */
  readonly mesh: (id: string) => Mesh3D | undefined
  /** Takes the meshes down and frees their geometry and materials. */
  dispose(): void
}

const MISSING = 0x808080

/** The mesh of a piece: its geometry from the piece's arrays, in the swatch's colour, with a material of its own. */
function meshOf(piece: WorldPiece, colour: number): Mesh3D {
  const { positions, normals, indices } = piece.mesh
  const low = [Infinity, Infinity, Infinity] as [number, number, number]
  const high = [-Infinity, -Infinity, -Infinity] as [number, number, number]
  for (let i = 0; i < positions.length; i += 3)
    for (let axis = 0; axis < 3; axis++) {
      low[axis] = Math.min(low[axis] as number, positions[i + axis] as number)
      high[axis] = Math.max(high[axis] as number, positions[i + axis] as number)
    }
  const geometry = new Geometry3D({
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
    bounds3D: new Box(new Vector3(...low), new Vector3(...high)),
  })
  return new Mesh3D({ geometry, material: new PhongMaterial({ baseColor: colour }) })
}

/** Draws `pieces` into `scene.parent`. */
export function drawWorld(scene: WorldScene, pieces: readonly WorldPiece[]): WorldView {
  const node = new Container3D()
  scene.parent.addChild(node)
  const meshes = new Map<string, Mesh3D>()
  for (const piece of pieces) {
    const mesh = meshOf(piece, scene.colourOf(tileName(piece.surface)) ?? scene.fallback ?? MISSING)
    node.addChild(mesh)
    meshes.set(piece.id, mesh)
    if (scene.occluders === undefined) continue
    if (piece.part === 'ceiling') scene.occluders.ceiling(mesh)
    else if (piece.part === 'wall' && piece.line !== undefined) {
      // The face’s height: the highest point of its mesh, from the floor at 0. A face that never rises above it (the
      // side of a pit) can hide nobody and follows no rule.
      let height = 0
      for (let i = 1; i < piece.mesh.positions.length; i += 3)
        height = Math.max(height, piece.mesh.positions[i] as number)
      if (height <= 0) continue
      const { a, b } = piece.line
      scene.occluders.face(mesh, { a: { x: a[0], z: a[1] }, b: { x: b[0], z: b[1] }, height }, piece.occlude)
    }
  }
  return {
    node,
    mesh: (id) => meshes.get(id),
    dispose() {
      for (const mesh of meshes.values()) mesh.destroy({ children: true })
      meshes.clear()
      node.destroy()
    },
  }
}
