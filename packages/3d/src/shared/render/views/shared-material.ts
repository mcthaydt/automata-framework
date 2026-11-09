// Materials shared between meshes (review of #249): a box view's boxes share one, and every mesh of a loaded
// model shares the model's. The occluder rule fades a prop through its material's alpha, so fading a mesh whose
// material is shared would fade every other mesh with it. A view that shares a material registers how to make a
// fresh one like it, and the rule gives a faded prop that copy.
import type { BaseMaterial3D } from '@pixi/3d'

const copies = new WeakMap<BaseMaterial3D, () => BaseMaterial3D>()

/** Marks `material` as shared between meshes, with `copy` making a fresh material that looks the same. */
export function shareMaterial<M extends BaseMaterial3D>(material: M, copy: () => M): M {
  copies.set(material, copy)
  return material
}

/** A fresh material like `material` when it is a shared one, else nothing. */
export function ownCopyOf<M extends BaseMaterial3D>(material: M): M | undefined {
  return copies.get(material)?.() as M | undefined
}
