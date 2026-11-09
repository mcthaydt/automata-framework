import type { StepResult } from '@automata/sim'

// A test's window on the running game: what the sim has done, read from the same steps the screen draws (so it can never
// change the game). Only a development build installs it, as `window.__automataDebug` (app/debug.ts); a journey calls it
// to see where the characters are and which mode each is in, since a picture shows neither.

/** One mode change a character made. */
export interface ModeChange {
  readonly tick: number
  readonly agent: string
  readonly from: string
  readonly to: string
}

/** Where a character was at the end of a tick. */
export interface TrailPoint {
  readonly tick: number
  readonly x: number
  readonly z: number
}

export interface AgentView {
  readonly id: string
  readonly mode: string
  readonly x: number
  readonly z: number
  readonly walking: boolean
}

export interface Probe {
  /** Feed it each step's result. */
  apply(result: StepResult): void
  tick(): number
  agents(): AgentView[]
  player(): { readonly x: number; readonly z: number }
  changes(): ModeChange[]
  trail(agent: string): TrailPoint[]
}

const TRAIL_LIMIT = 7200

/**
 * @param ids the behaviour file's characters, in the order the file lists them
 * @param starts the mode each begins in
 * @param actor the id of the component the screen draws characters from, and `player` the one it draws the player from
 */
export function createProbe(
  ids: readonly string[],
  starts: Readonly<Record<string, string>>,
  actor: string,
  player: string,
): Probe {
  let tick = 0
  const modes: Record<string, string> = { ...starts }
  const where = new Map<string, { x: number; z: number; walking: boolean }>()
  const trails = new Map<string, TrailPoint[]>()
  const changes: ModeChange[] = []
  let you = { x: 0, z: 0 }

  return {
    apply(result) {
      tick = result.tick
      for (const event of result.events) {
        if (event.type !== 'systems.mode') continue
        const change = event.payload as { agent: string; from: string; to: string }
        modes[change.agent] = change.to
        changes.push({ tick: result.tick, ...change })
      }
      for (const row of [...result.render.added, ...result.render.changed]) {
        const a = row.components[actor] as
          | { x: number; z: number; walking: boolean; index: number }
          | undefined
        const id = a === undefined ? undefined : ids[a.index]
        if (a !== undefined && id !== undefined) where.set(id, { x: a.x, z: a.z, walking: a.walking })
        const p = row.components[player] as { x: number; z: number } | undefined
        if (p !== undefined) you = { x: p.x, z: p.z }
      }
      for (const [id, at] of where) {
        const trail = trails.get(id) ?? []
        trail.push({ tick, x: at.x, z: at.z })
        if (trail.length > TRAIL_LIMIT) trail.shift()
        trails.set(id, trail)
      }
    },
    tick: () => tick,
    agents: () =>
      ids.flatMap((id) => {
        const at = where.get(id)
        return at === undefined ? [] : [{ id, mode: modes[id] ?? '', ...at }]
      }),
    player: () => you,
    changes: () => [...changes],
    trail: (agent) => [...(trails.get(agent) ?? [])],
  }
}
