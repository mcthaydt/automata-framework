// The Dollhouse viewport as plain TypeScript (ED3D.5e, plan decision 2; ED3D spec §6, §10): what the gestures on the 3D
// view do. The orbit is the viewport's own state, not the document's: it is not undoable (spec §5.4: `camera.set` is
// not) and is framed once per canvas until it is moved by hand. A tap selects through the editor's one selection, so the
// plan shows what the dollhouse picked, and the other way round. The mesh is built once per level from the geometry
// cache, so the dollhouse, the plan and the checks never disagree.
import type { PointerKind, Size } from '@automata/editor/kit/core'
import type { LevelEditor } from '../model/level-editor'
import { fitOrbit, type Orbit, orbitBy, orbitCamera, rayThrough } from '../view/mesh/camera-3d'
import { pickMesh } from '../view/mesh/mesh-pick'
import { buildSectorMesh, type SectorMesh } from '../view/mesh/sector-mesh'
import { createGeometryCache } from './geometry-cache'

export interface DollhouseView {
  readonly orbit: Orbit
  readonly mesh: SectorMesh
}

export interface DollhouseController {
  readonly view: DollhouseView
  /** Calls `run` after the orbit or the mesh changes. Returns the unsubscribe. */
  subscribe(run: () => void): () => void
  /** A one-finger or mouse drag of (dx, dy) pixels: across turns the yaw, up and down tips the pitch. */
  orbitBy(dx: number, dy: number): void
  /** A pinch or the wheel: `factor` above 1 comes nearer. */
  zoomBy(factor: number): void
  /** A two-finger twist, in radians. */
  twist(radians: number): void
  /** Selects what the tap hits; a tap on nothing clears the selection. */
  tap(at: { readonly x: number; readonly y: number; readonly kind: PointerKind }): void
  /** Frames the whole level again from the home angles. */
  fit(): void
  resize(size: Size): void
  dispose(): void
}

/** Radians a pixel of drag turns the camera: a drag across a 600 px view turns it about one and a half times round. */
const RADIANS_PER_PIXEL = 0.016
const NEAREST = 1
const FARTHEST = 1000

export function createDollhouseController<D>(editor: LevelEditor<D>, canvas: Size): DollhouseController {
  const listeners = new Set<() => void>()
  const geometry = createGeometryCache(editor)
  let size = canvas
  let built: { readonly level: D; readonly mesh: SectorMesh } | undefined
  /** Whether the camera was moved by hand: until then each resize and each new level frames again. */
  let moved = false

  const meshNow = (): SectorMesh => {
    const { layers, select, level } = geometry()
    if (built?.level !== level) built = { level, mesh: buildSectorMesh(layers, select) }
    return built.mesh
  }
  let orbit = fitOrbit(meshNow().bounds, size)

  const notify = (): void => {
    for (const run of [...listeners]) run()
  }
  const show = (next: Orbit, byHand: boolean): void => {
    orbit = next
    if (byHand) moved = true
    notify()
  }
  const stopHistory = editor.history.subscribe(() => {
    const before = built?.mesh
    if (meshNow() === before) return
    if (!moved) orbit = fitOrbit(meshNow().bounds, size)
    notify()
  })

  return {
    get view() {
      return { orbit, mesh: meshNow() }
    },
    subscribe(run) {
      listeners.add(run)
      return () => listeners.delete(run)
    },
    orbitBy(dx, dy) {
      show(orbitBy(orbit, dx * RADIANS_PER_PIXEL, dy * RADIANS_PER_PIXEL), true)
    },
    zoomBy(factor) {
      if (!(factor > 0)) return
      show({ ...orbit, distance: Math.min(Math.max(orbit.distance / factor, NEAREST), FARTHEST) }, true)
    },
    twist(radians) {
      show(orbitBy(orbit, radians, 0), true)
    },
    tap(at) {
      const hit = pickMesh(meshNow(), rayThrough(orbitCamera(orbit), size, at))
      if (hit?.selection === undefined) editor.selection.clear()
      else editor.selection.set([hit.selection])
    },
    fit() {
      moved = false
      show(fitOrbit(meshNow().bounds, size), false)
    },
    resize(next) {
      size = next
      if (!moved) orbit = fitOrbit(meshNow().bounds, size)
      notify()
    },
    dispose() {
      stopHistory()
      listeners.clear()
    },
  }
}
