// Window light on the floor, drawn: each patch (`light-patch.ts`) is one flat quad lying a hair above the floor, textured with its
// stripes and added to what is under it, in the room's own 3D pass, so the look's snap that follows cuts the sum into whole DUEL
// steps. It is lit by nothing (it is light) and fogged by nothing.
import { Box, type Container3D, FlatMaterial, Geometry3D, Mesh3D, Vector3 } from '@pixi/3d'
import { BufferImageSource, Texture } from 'pixi.js'
import {
  type LightPatch,
  lightPatchCorners,
  lightPatchPixels,
  patchShown,
} from '../../shared/render/light/light-patch.ts'

/** What drawing patches leaves behind. */
export interface LightPatches {
  /** Shows the patches whose rooms are drawn (the same set `drawWorld`'s `showRooms` takes); every patch for none. */
  showRooms(rooms: ReadonlySet<string> | undefined): void
  destroy(): void
}

/** Lays each of `patches` on the floor under `parent`. */
export function drawLightPatches(parent: Container3D, patches: readonly LightPatch[]): LightPatches {
  const meshes = patches.map((patch) => {
    const corners = lightPatchCorners(patch)
    const { width, height, rgba } = lightPatchPixels(patch)
    const texture = new Texture({
      source: new BufferImageSource({
        resource: rgba,
        width,
        height,
        format: 'rgba8unorm',
        scaleMode: 'nearest',
        autoGenerateMipmaps: false,
      }),
    })
    const xs = corners.map((c) => c[0])
    const zs = corners.map((c) => c[2])
    const geometry = new Geometry3D({
      positions: new Float32Array(corners.flat()),
      normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
      uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      indices: new Uint16Array([0, 2, 1, 0, 3, 2]),
      bounds3D: new Box(
        new Vector3(Math.min(...xs), -0.01, Math.min(...zs)),
        new Vector3(Math.max(...xs), 0.03, Math.max(...zs)),
      ),
    })
    const material = new FlatMaterial({
      baseColor: 0xffffff,
      baseColorTexture: texture,
      alphaMode: 'blend',
      doubleSided: true,
      fog: false,
    })
    material.state.blendMode = 'add'
    const mesh = new Mesh3D({ geometry, material })
    mesh.castShadow = false
    parent.addChild(mesh)
    return { patch, mesh, geometry, material, texture }
  })
  return {
    showRooms(rooms) {
      for (const each of meshes) each.mesh.visible = patchShown(each.patch, rooms)
    },
    destroy() {
      for (const each of meshes) {
        each.mesh.destroy()
        each.geometry.destroy(true)
        each.material.destroy()
        each.texture.destroy(true)
      }
    },
  }
}
