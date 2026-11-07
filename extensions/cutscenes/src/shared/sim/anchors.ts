// Anchors: an actor row stands at a point or at a named anchor (`player`, `actor:<who>`, a hotspot or a nav
// node the game names), resolved when the cutscene starts. A script that names an anchor the scene cannot resolve is not
// played.
import type { ActorKey, CutsceneScript } from './cutscene.schema'

/** An actor key with its position settled to a point. */
export type PlacedActorKey = Omit<ActorKey, 'at' | 'x' | 'z'> & { readonly x: number; readonly z: number }
/** A script whose actors all stand at points: what `evaluate` takes. */
export type PlacedScript = Omit<CutsceneScript, 'actor'> & {
  readonly actor?: readonly PlacedActorKey[] | undefined
}

/** The anchors a script names, once each, sorted. */
export function anchorsOf(script: CutsceneScript): string[] {
  return [...new Set((script.actor ?? []).flatMap((a) => (a.at === undefined ? [] : [a.at])))].sort()
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
  return { ok: true, script: { ...script, actor } }
}
