import { installDebug, shippedPanels } from '@automata/debug'
import type { PixiStageHooks } from '@automata/framework'
import { SystemsAgent } from '@automata/systems/sim'
import { Hero } from '../features/square/hero.component.ts'
import { Square } from '../features/square/square.component.ts'
import { SYSTEMS } from '../features/story/story-content.ts'
import { METRE } from '../shared/constants.ts'
import { createProbe } from './probe.ts'

// A development build tells a journey what the sim does: `window.__automataDebug` answers where the characters are and
// which mode each is in. It reads each step the screen draws and never writes the sim. A release build leaves it out.

/** Hooks for the renderer's `setup` that feed the probe, or none in a release build. */
export function debugHooks(): PixiStageHooks | undefined {
  if (!__AUTOMATA_DEBUG__) return undefined
  const probe = createProbe(
    SYSTEMS.agents.map((agent) => agent.id),
    Object.fromEntries(SYSTEMS.agents.map((agent) => [agent.id, agent.initial])),
    { agent: SystemsAgent.id, at: Square.id, hero: Hero.id },
    METRE,
  )
  installDebug({
    panels: shippedPanels,
    driver: {
      tick: probe.tick,
      agents: probe.agents,
      player: probe.player,
      changes: probe.changes,
      trail: probe.trail,
    },
  })
  return { apply: (result) => probe.apply(result) }
}
