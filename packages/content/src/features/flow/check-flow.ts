// The screen flow: which screen follows which, authored in `content/flow.toml`.
// Extracted from FloorFifty packages/content/src/validate/flow.ts (122a220). Cycles are legal (racing again
// returns through the menu on purpose); a graph a player can get stuck in is not, and neither is one that
// re-enters the entry screen after the game has started.
//
// FloorFifty's screens, events and destinations were code-owned (`FLOW_TARGETS`). Here they are the game's
// `FlowCapabilities`: with them every FloorFifty check applies; without them the graph checks still do.

import { z } from 'zod'
import type { Problem } from '../../shared/diagnostics/diagnostic'

export interface FlowSource {
  readonly entry: string
  /** Screens with no way out by design (a credits roll). */
  readonly terminal?: string[] | undefined
  readonly transitions: {
    readonly from: string
    readonly event: string
    readonly to: string
    /** How the screens change; absent is a cut. */
    readonly transition?: string | undefined
  }[]
}

export const flowSchema: z.ZodType<FlowSource> = z.strictObject({
  entry: z.string().min(1),
  terminal: z.optional(z.array(z.string().min(1))),
  transitions: z.array(
    z.strictObject({
      from: z.string().min(1),
      event: z.string().min(1),
      to: z.string().min(1),
      transition: z.optional(z.string()),
    }),
  ),
})

/** What the game's code implements: the screens, and optionally the pairs and destinations each allows. */
export interface FlowCapabilities {
  /** The only screen a session may begin on. */
  readonly entry?: string
  readonly screens: readonly string[]
  /** For each screen and event, the destinations that screen is prepared to enter (FloorFifty `FLOW_TARGETS`). */
  readonly targets?: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>
  /** Transition styles the runtime draws. Default: only `cut`. */
  readonly styles?: readonly string[]
}

/**
 * One checked move in the flow: on `event` the game goes `from` one screen `to` another, drawn in the
 * `transition` style (`cut` when unwritten).
 */
export interface FlowTransition {
  readonly from: string
  readonly event: string
  readonly to: string
  readonly transition: string
}

/**
 * The checked screen flow from `flow.toml`: the entry screen, every screen, the terminal screens and every
 * transition, in a fixed order.
 */
export interface FlowGraph {
  readonly entry: string
  /** Sorted. */
  readonly screens: readonly string[]
  /** Sorted. */
  readonly terminal: readonly string[]
  /** Sorted by from, event, then to (FloorFifty `byPair`): declaration order means nothing. */
  readonly transitions: readonly FlowTransition[]
}

const STYLE_PATTERN = /^[a-z][a-z0-9-]*$/
const pairKey = (from: string, event: string): string => `${from}.${event}`
const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/** Screens the entry can lead to. */
function reachableFrom(entry: string, transitions: readonly FlowTransition[]): Set<string> {
  const reached = new Set([entry])
  const queue = [entry]
  while (queue.length > 0) {
    const screen = queue.shift() as string
    for (const transition of transitions) {
      if (transition.from !== screen || reached.has(transition.to)) continue
      reached.add(transition.to)
      queue.push(transition.to)
    }
  }
  return reached
}

export function checkFlow(
  flow: FlowSource,
  capabilities?: FlowCapabilities | undefined,
): { graph: FlowGraph; problems: Problem[] } {
  const problems: Problem[] = []
  const refuse = (path: Problem['path'], message: string): void => {
    problems.push({ path, code: 'invalidFlow', message })
  }
  const transitions: FlowTransition[] = flow.transitions.map((t) => ({
    ...t,
    transition: t.transition ?? 'cut',
  }))
  const terminal = flow.terminal ?? []

  if (capabilities?.entry !== undefined && flow.entry !== capabilities.entry) {
    refuse(['entry'], `entry must be ${capabilities.entry}, received ${flow.entry}`)
  }

  const known = capabilities === undefined ? undefined : new Set(capabilities.screens)
  const checkScreen = (path: Problem['path'], screen: string): void => {
    if (known === undefined || known.has(screen)) return
    refuse(path, `unknown screen ${screen}; expected one of ${capabilities?.screens.join(', ')}`)
  }
  checkScreen(['entry'], flow.entry)
  terminal.forEach((screen, index) => {
    checkScreen(['terminal', index], screen)
  })

  const styles = capabilities?.styles ?? (capabilities === undefined ? undefined : ['cut'])
  const targets = capabilities?.targets
  const seen = new Set<string>()

  transitions.forEach((transition, index) => {
    const at = (field: string): Problem['path'] => ['transitions', index, field]
    const key = pairKey(transition.from, transition.event)
    const allowed = targets?.[transition.from]?.[transition.event]
    const declared = targets === undefined || allowed !== undefined
    if (!declared) refuse(at('event'), `${transition.from} declares no ${transition.event} transition`)
    checkScreen(at('from'), transition.from)
    checkScreen(at('to'), transition.to)
    if (styles === undefined) {
      if (!STYLE_PATTERN.test(transition.transition)) {
        refuse(at('transition'), `transition styles match ${STYLE_PATTERN.source}`)
      }
    } else if (!styles.includes(transition.transition)) {
      refuse(at('transition'), `transition ${transition.transition} is not one of ${styles.join(', ')}`)
    }
    if (!declared) return

    if (seen.has(key)) {
      refuse(at('event'), `${key} is declared more than once`)
      return
    }
    seen.add(key)
    if (transition.from === transition.to) refuse(at('to'), `${transition.from} may not transition to itself`)
    else if (allowed !== undefined && !allowed.includes(transition.to)) {
      refuse(at('to'), `${key} may reach only ${allowed.join(', ')}, received ${transition.to}`)
    }
  })

  if (targets !== undefined) {
    for (const from of Object.keys(targets)) {
      for (const event of Object.keys(targets[from] ?? {})) {
        const key = pairKey(from, event)
        if (!seen.has(key)) refuse(['transitions'], `${key} has no transition`)
      }
    }
  }

  const intoEntry = transitions.findIndex((t) => t.to === flow.entry)
  if (intoEntry !== -1) {
    refuse(['transitions', intoEntry, 'to'], `the entry screen ${flow.entry} may have no incoming transition`)
  }

  const named = new Set([flow.entry, ...terminal, ...transitions.flatMap((t) => [t.from, t.to])])
  const screens = capabilities?.screens ?? [...named].sort(compareText)
  const reached = reachableFrom(flow.entry, transitions)
  for (const screen of screens) {
    if (!reached.has(screen)) {
      const from = transitions.findIndex((t) => t.from === screen)
      refuse(
        from === -1 ? ['entry'] : ['transitions', from, 'from'],
        `${screen} is not reachable from ${flow.entry}`,
      )
      continue
    }
    if (terminal.includes(screen) || transitions.some((t) => t.from === screen)) continue
    const into = transitions.findIndex((t) => t.to === screen)
    refuse(into === -1 ? ['entry'] : ['transitions', into, 'to'], `${screen} has no outgoing transition`)
  }

  const graph: FlowGraph = {
    entry: flow.entry,
    screens: [...new Set([...named, ...(capabilities?.screens ?? [])])].sort(compareText),
    terminal: [...terminal].sort(compareText),
    transitions: [...transitions].sort(
      (a, b) => compareText(a.from, b.from) || compareText(a.event, b.event) || compareText(a.to, b.to),
    ),
  }
  return { graph, problems }
}
