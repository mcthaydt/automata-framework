// The use of a hotspot, in the `gameplay` phase after nav: new commands first (a use becomes pending, a combine or a
// code happens at once), then the pending use is settled: it fires when the player is within reach, waits while the
// player is still walking, and is dropped when its condition stops holding or the walk ended short of it, so a use
// that could not be reached can never fire later (a door opening afterwards does not revive it).
//
// Reading nav's routes is how a refused walk is known: the sim has no reading of a step's own events, and nav drops a
// walker's route when there is no way to the target.
import { NavRoutes } from '@automataframework/nav/sim'
import { applyVerb, holds } from '@automataframework/puzzle/sim'
import { defineSystem, type SimContext, type SystemDef } from '@automataframework/sim'
import type { Hotspot } from './hotspot.schema'
import { Cancel, Combine, EnterCode, Use } from './interact.command'
import { InteractPending, InteractRefused, InteractUsed, type RefusedReason } from './interact.event'
import { InteractState } from './interact.resource'
import type { InteractOptions } from './interact-options'
import { fateOf } from './pending'

const usable = (options: InteractOptions, ctx: SimContext, spot: Hotspot): boolean => {
  const reader = options.reader(ctx)
  return (spot.when ?? []).every((condition) => holds(reader, { at: spot.id }, condition))
}

function fire(ctx: SimContext, options: InteractOptions, spot: Hotspot, held: string | undefined): void {
  // A hiding place hides unless the player holds something to use on it.
  const hid = spot.hide === true && held === undefined && options.hide !== undefined
  if (hid) options.hide?.(ctx, spot.id)
  else applyVerb(ctx, held === undefined ? { at: spot.id } : { at: spot.id, held }, options.puzzle)
  ctx.emit(InteractUsed, held === undefined ? { at: spot.id, hid } : { at: spot.id, held, hid })
}

export const interactSystem = (options: InteractOptions): SystemDef =>
  defineSystem({
    name: 'interact.run',
    phase: 'gameplay',
    after: ['nav.walk'],
    run: (ctx) => {
      const state = ctx.resource(InteractState)
      const refuse = (at: string, reason: RefusedReason): void => {
        state.pending = null
        ctx.emit(InteractRefused, { at, reason })
      }
      // Within a tick the order is: cancels, uses, combines, codes (commands of one kind keep their order).
      if (ctx.commands.of(Cancel).length > 0) state.pending = null
      for (const { payload } of ctx.commands.of(Use)) {
        const spot = state.hotspots.find((h) => h.id === payload.at)
        if (spot === undefined) refuse(payload.at, 'unknown')
        else if (!usable(options, ctx, spot)) refuse(payload.at, 'unavailable')
        else {
          // A new use replaces the one that was waiting.
          state.pending = payload.held === undefined ? { at: spot.id } : { at: spot.id, held: payload.held }
          ctx.emit(InteractPending, { at: spot.id })
        }
      }
      for (const { payload } of ctx.commands.of(Combine))
        applyVerb(ctx, { at: 'combine', pair: [payload.a, payload.b] }, options.puzzle)
      for (const { payload } of ctx.commands.of(EnterCode))
        applyVerb(ctx, { at: 'code', code: payload.code }, options.puzzle)

      const pending = state.pending
      if (pending === null) return
      const spot = state.hotspots.find((h) => h.id === pending.at)
      if (spot === undefined) return refuse(pending.at, 'unknown')
      if (!usable(options, ctx, spot)) return refuse(pending.at, 'unavailable')
      const player = options.player(ctx)
      const routes = ctx.resource(NavRoutes)
      const walking = player !== undefined && routes[String(player.entity)] !== undefined
      const fate = fateOf(player, spot, walking)
      if (fate === 'drop') return refuse(pending.at, 'unreachable')
      if (fate === 'wait' || player === undefined) return
      // In reach: stop the walk where it stands, then act.
      delete routes[String(player.entity)]
      state.pending = null
      fire(ctx, options, spot, pending.held)
    },
  })
