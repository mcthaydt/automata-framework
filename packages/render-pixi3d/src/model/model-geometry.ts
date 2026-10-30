import { Box, Geometry3D, Vector3 } from '@pixi/3d'
import type { ModelMesh } from './parse-glb.js'

/**
 * The `@pixi/3d` geometry of a parsed model. Both file types go through here, so a `.bin` and a `.glb` holding the
 * same values build the same vertex buffers (D3-c). The bounds are the file's own, so props fit as authored.
 */
export function modelGeometry(mesh: ModelMesh): Geometry3D {
  return new Geometry3D({
    positions: mesh.positions,
    normals: mesh.normals,
    uvs: mesh.uvs,
    indices: mesh.indices,
    bounds3D: new Box(new Vector3(...mesh.min), new Vector3(...mesh.max)),
  })
}
