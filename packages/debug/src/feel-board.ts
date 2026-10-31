// The feel board (the adventure source's board, as a panel's port): every event `feel.toml` reacts to, and a way to fire one at the
// current tick. A `*` pattern fires as a concrete event id. Firing only gives `feel` an event to hear; it changes nothing in the sim.
import type { Feel, FeelContent } from '@mcthaydt/automata-feel'
import type { FeelBoardPort } from './host'

export function feelBoard(content: () => FeelContent, feel: Feel, tick: () => number): FeelBoardPort {
  return {
    entries: () => [...new Set((content().entry ?? []).map((e) => e.on))],
    fire: (on) => feel.hear(tick(), [{ type: on.replaceAll('*', 'x'), payload: null }]),
  }
}
