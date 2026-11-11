// A route made again on a clock, as a hook. `goTo` routes an agent once, to where the player stood; chasing a player who
// moves needs the route made again every so often (the old game's `replan`, every 0.4 s). A world rule has no agent of its
// own to send, and an `every` on the `goTo` effect would change the schema of every systems snapshot, so a transition
// calls this hook (`{ call = "chase" }`, with `hooks: { chase: followPlayer(0.4) }`). It keeps its clock in the agent's own
// `replan`, which snapshots carry.
import { goTo } from './effect'
import type { SystemsOptions, SystemsWorld } from './world'

type Hook = NonNullable<SystemsOptions['hooks']>[string]

/**
 * A hook that routes its agent to the player now, and again every `every` seconds while the hook keeps being called
 * (put it on a transition from a mode to itself, which runs each step the mode holds). A world rule has no agent: nothing.
 */
export function followPlayer(every: number): Hook {
  return (w: SystemsWorld, agent: string | null): void => {
    if (agent === null) return
    const record = w.state.agents[agent]
    if (record === undefined) return
    record.replan -= w.ctx.dt
    if (record.replan > 1e-9) return
    record.replan = every
    goTo(w, agent, w.player)
  }
}
