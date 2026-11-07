// Hint probes (M6.8b step 5; from the source's `hintProbes`): for each lethal rule and each route that exposes its risk
// (a step that sets up a systemic entry with a risk), each `hintedBy` action the route can take at or before that
// step, played in the sim at the first point it can be, and the lines it showed.
import { createSolver } from '@mcthaydt/automata-puzzle/solver'
import type { HintProbe } from './coverage'
import { type PlayRoute, play, shown, solverRoutes, type TraceGame } from './traces'

export async function hintProbes(
  game: TraceGame,
  routes: readonly PlayRoute[] = solverRoutes(game.puzzle),
): Promise<{ probes: HintProbe[]; exposes: { lethal: string; route: string; step: number }[] }> {
  const { def, model } = game.puzzle
  const solver = createSolver(def, model)
  const exposing = new Set(def.systemic.filter((s) => s.risk !== undefined).flatMap((s) => s.via))
  const probes: HintProbe[] = []
  const exposes: { lethal: string; route: string; step: number }[] = []
  // Routes share prefixes (most hints can be taken at the start), so each distinct probe is played once.
  const played = new Map<string, string[]>()
  for (const route of routes) {
    const exposedAt = route.steps.findIndex((s) => exposing.has(s.action))
    if (exposedAt < 0) continue
    const entry = def.entry.find((e) => e.name === route.entry)
    if (entry === undefined) continue
    // The solver's state before each step, up to the exposing one.
    const states = [solver.start(entry)]
    for (let i = 0; i < exposedAt; i++) {
      const step = route.steps[i]
      const state = states[i]
      if (step === undefined || state === undefined) break
      const next = solver.next(state, step, def.actions.find((a) => a.id === step.action) ?? null)[0]
      if (next !== undefined) states.push(next)
    }
    for (const l of def.lethal) {
      exposes.push({ lethal: l.id, route: route.name, step: exposedAt + 1 })
      for (const action of l.hintedBy) {
        const i = states.findIndex((s) => solver.verbs(s, new Set()).some((v) => v.step.action === action))
        if (i < 0) continue
        const verbs = solver
          .verbs(states[i] as (typeof states)[number], new Set())
          .filter((v) => v.step.action === action)
        const verb = verbs.find((v) => v.step.held === undefined) ?? verbs[0]
        if (verb === undefined) continue
        const key = JSON.stringify([route.entry, route.steps.slice(0, i), verb.step])
        if (!played.has(key)) {
          const trace = await play(game, route, { upTo: i, then: verb.step })
          const mark = trace.events.findIndex((e) => e.kind === 'step' && e.n === i + 1)
          played.set(key, shown({ ...trace, events: trace.events.slice(mark + 1) }))
        }
        probes.push({ lethal: l.id, route: route.name, action, lines: played.get(key) ?? [] })
      }
    }
  }
  return { probes, exposes }
}
