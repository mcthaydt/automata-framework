// The blockout's walking graph as a `nav-graph` file: nodes by id, edges between them, and a door on an edge that
// needs it open. The old patrol is a route the creature's behaviour owns now (the systems file), so it is only reported.
import { stringify } from 'smol-toml'
import type { Converted, Unexpressed } from './report.ts'

const NAV_PATH = 'content/nav/prologue.toml'

const HEADER =
  "# The prologue's walking graph. It was converted once from the game's prologue at 92e6704 (through October's fixture),\n# and this file is now the source: edit it by hand and in Schematic.\n"

/** The graph of the blockout's `nav` as TOML. */
export function convertNav(blockout: unknown): Converted {
  const nav = (
    blockout as { nav?: { nodes?: Record<string, unknown>; edges?: unknown[]; patrol?: unknown[] } } | null
  )?.nav
  if (nav?.nodes === undefined || nav.edges === undefined)
    throw new Error('The blockout has no nav (nodes and edges) to convert.')
  const report: Unexpressed[] = []
  if (nav.patrol !== undefined)
    report.push({
      kind: 'nav',
      where: 'patrol',
      what: `the patrol of ${nav.patrol.length} stops: the creature's rules own its route now`,
      did: 'dropped',
    })
  const nodes = Object.fromEntries(
    Object.entries(nav.nodes).map(([id, at]) => [
      id,
      { x: (at as { x: number }).x, z: (at as { z: number }).z },
    ]),
  )
  return { files: { [NAV_PATH]: `${HEADER}${stringify({ edges: nav.edges, nodes })}\n` }, report }
}
