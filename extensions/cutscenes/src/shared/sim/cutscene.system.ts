// The cutscene step. A cutscene is sim ticks: it starts as an event at tick T, ends at
// `T + round(duration / dt)` or on `cutscene.skip`, and while one is under way `locked` holds, so gameplay input that
// reads it is ignored. A start while one plays replaces it; a script whose anchor does not resolve is skipped at
// once and never locks. The step runs in `input`, before gameplay reads its commands.
import { defineSystem, type SimContext, type SystemDef } from '@automata/sim'
import { CutsceneSkip } from './cutscene.command'
import { CutsceneEnded, CutsceneStarted } from './cutscene.event'
import { CutsceneScene, CutsceneState } from './cutscene.resource'

export interface CutscenesOptions {
  /** What provides the game's places, so the extension requires it: sectors' 3D rooms (the default) or a 2D level. */
  readonly places?: { readonly provider: string }
  /** Where a named anchor stands now (`player`, `actor:nurse`, a hotspot or nav node); undefined when the scene lacks it. */
  readonly anchor?: (ctx: SimContext, name: string) => { readonly x: number; readonly z: number } | undefined
}

/** Whether a cutscene is under way. */
export const locked = (ctx: SimContext): boolean => ctx.resource(CutsceneState).id !== null

function end(ctx: SimContext, skipped: boolean): void {
  const state = ctx.resource(CutsceneState)
  if (state.id === null) return
  ctx.emit(CutsceneEnded, { id: state.id, skipped, missing: [] })
  state.id = null
}

/** Starts cutscene `id` now. An id the scene does not have does nothing (a content error the compile catches). */
export function startCutscene(ctx: SimContext, id: string, options: CutscenesOptions = {}): void {
  const script = ctx.resource(CutsceneScene).scripts.find((s) => s.id === id)
  if (script === undefined) return
  const missing = script.anchors.filter((name) => options.anchor?.(ctx, name) === undefined)
  if (missing.length > 0) {
    ctx.emit(CutsceneEnded, { id, skipped: true, missing })
    return
  }
  end(ctx, true)
  const state = ctx.resource(CutsceneState)
  state.id = id
  state.start = ctx.tick
  state.end = ctx.tick + Math.round(script.duration / ctx.dt)
  ctx.emit(CutsceneStarted, { id, start: state.start, end: state.end })
}

export const cutsceneSystem: SystemDef = defineSystem('cutscene.step', 'input', (ctx) => {
  const state = ctx.resource(CutsceneState)
  if (state.id === null) return
  for (const _ of ctx.commands.of(CutsceneSkip)) {
    end(ctx, true)
    return
  }
  if (ctx.tick >= state.end) end(ctx, false)
})
