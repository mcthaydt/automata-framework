// Anchors: an actor row stands at a point or at a named anchor, and a camera key may be an offset from one (`player`,
// `actor:<who>`, a hotspot or a nav node the game names), resolved when the cutscene starts. A script that names an anchor
// the scene cannot resolve is not played.
import type { ActorKey, CameraKey, CutsceneScript } from './cutscene.schema'

/** An actor key with its position settled to a point. */
export type PlacedActorKey = Omit<ActorKey, 'at' | 'x' | 'z'> & { readonly x: number; readonly z: number }
/** A camera key with its anchor settled: `pos` and `look` are points in the level. */
export type PlacedCameraKey = Omit<CameraKey, 'about'>
/** A script whose actors and camera all stand at points: what `evaluate` takes. */
export type PlacedScript = Omit<CutsceneScript, 'actor' | 'camera'> & {
  readonly actor?: readonly PlacedActorKey[] | undefined
  readonly camera: readonly PlacedCameraKey[]
}

/** The anchors a script's actors and camera name, once each, sorted. */
export function anchorsOf(script: CutsceneScript): string[] {
  const actors = (script.actor ?? []).flatMap((a) => (a.at === undefined ? [] : [a.at]))
  const cameras = script.camera.flatMap((k) => (k.about === undefined ? [] : [k.about]))
  return [...new Set([...actors, ...cameras])].sort()
}

/** The script with every anchor replaced by its point, or the anchors `where` could not resolve. */
export function placeScript(
  script: CutsceneScript,
  where: (anchor: string) => { readonly x: number; readonly z: number } | undefined,
): { readonly ok: true; readonly script: PlacedScript } | { readonly ok: false; readonly missing: string[] } {
  const missing = anchorsOf(script).filter((name) => where(name) === undefined)
  if (missing.length > 0) return { ok: false, missing }
  const actor = (script.actor ?? []).map((a): PlacedActorKey => {
    const { at, x, z, ...rest } = a
    const point = at === undefined ? undefined : where(at)
    return { ...rest, x: point?.x ?? x ?? 0, z: point?.z ?? z ?? 0 }
  })
  const camera = script.camera.map((key): PlacedCameraKey => {
    const { about, pos, look, ...rest } = key
    const point = about === undefined ? undefined : where(about)
    if (point === undefined) return { ...rest, pos, look }
    return {
      ...rest,
      pos: [point.x + pos[0], pos[1], point.z + pos[2]],
      look: [point.x + look[0], look[1], point.z + look[2]],
    }
  })
  return { ok: true, script: { ...script, actor, camera } }
}
