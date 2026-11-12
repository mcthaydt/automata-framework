import type { Page } from '@playwright/test'
import type { ProbeState } from '#src/app/probe.ts'
import type { BotStep } from '#src/testing/bot.ts'

// Plays the prologue through the page the way a person's controls do, and waits on the game's own state through the probe
// (`src/app/probe.ts`, in a development build) and never on a sleep: a software renderer runs the simulation slower than the
// clock, so a wait is for a state, not for a time. The route is the bot's (`src/testing/route.ts`), so the page and Node play the
// same night.

/** A condition the page can check on the game's state: serialisable, since it runs in the page. */
export type Until =
  | { readonly fact: string; readonly is?: unknown }
  | { readonly cutscene: string | null }
  | { readonly events: string; readonly atLeast: number }
  | { readonly tickAtLeast: number }

/** The probe's state now. */
export async function stateOf(page: Page): Promise<ProbeState> {
  const state = await page.evaluate(() => globalThis.__lastLight?.state())
  if (state === undefined)
    throw new Error('the page has no probe state: is this a development build, and is play on screen?')
  return state
}

/** Waits for the game to be in `until`, for at most `ms` of the clock. */
export async function waitFor(page: Page, until: Until, ms = 120_000): Promise<void> {
  await page.waitForFunction(
    (wanted) => {
      const state = globalThis.__lastLight?.state()
      if (state === undefined) return false
      if ('fact' in wanted) return state.facts[wanted.fact] === (wanted.is === undefined ? true : wanted.is)
      if ('cutscene' in wanted) return state.cutscene === wanted.cutscene
      if ('events' in wanted) return (state.events[wanted.events] ?? 0) >= wanted.atLeast
      return state.tick >= wanted.tickAtLeast
    },
    until,
    { timeout: ms, polling: 100 },
  )
}

/** How many uses (done or refused) the sim has answered so far. */
async function answered(page: Page): Promise<{ used: number; refused: number }> {
  const events = (await stateOf(page)).events
  return { used: events['interact.used'] ?? 0, refused: events['interact.refused'] ?? 0 }
}

/** Does one step of the route through the page's own controls, and returns what stopped it, if anything. */
async function perform(page: Page, step: BotStep): Promise<string | undefined> {
  await waitFor(page, { cutscene: null })
  if ('tap' in step) {
    const before = await answered(page)
    await page.evaluate(([at, held]) => globalThis.__lastLight?.tap(at, held), [step.tap, step.held] as const)
    await page.waitForFunction(
      ([used, refused]) => {
        const events = globalThis.__lastLight?.state()?.events ?? {}
        return (events['interact.used'] ?? 0) > used || (events['interact.refused'] ?? 0) > refused
      },
      [before.used, before.refused] as const,
      { timeout: 120_000, polling: 100 },
    )
    const after = await answered(page)
    return after.refused > before.refused ? `${step.tap} was refused` : undefined
  }
  const tick = (await stateOf(page)).tick
  if ('combine' in step)
    await page.evaluate(
      ([a, b]) => globalThis.__lastLight?.combine(a, b),
      step.combine as readonly [string, string],
    )
  else if ('code' in step) await page.evaluate((code) => globalThis.__lastLight?.code(code), step.code)
  else if ('lamp' in step) await page.evaluate(() => globalThis.__lastLight?.lamp())
  else if ('wait' in step) {
    await waitFor(page, { tickAtLeast: tick + Math.round(step.wait * 60) }, 300_000)
    return undefined
  } else {
    const hidden = await perform(page, { tap: step.spot })
    if (hidden !== undefined) return hidden
    await waitFor(page, { fact: step.hideUntil }, 300_000)
    return undefined
  }
  // The command is sent for the next tick: let it be answered.
  await waitFor(page, { tickAtLeast: tick + 3 })
  return undefined
}

/** What a night came to. */
export interface Night {
  readonly stuck: string | undefined
  readonly facts: Readonly<Record<string, unknown>>
  readonly items: readonly string[]
  /** The cutscenes that ended, played out or skipped, by `<id>:<played|skipped>`. */
  readonly ended: readonly string[]
}

/** Plays `route` from the moment play is on screen, waits for the last cutscene to end, and says how it went. */
export async function playRoute(page: Page, route: readonly BotStep[]): Promise<Night> {
  let stuck: string | undefined
  for (const step of route) {
    stuck = await perform(page, step)
    if (stuck !== undefined) break
  }
  if (stuck === undefined) await waitFor(page, { events: 'cutscene.ended:rest:played', atLeast: 1 }, 300_000)
  const state = await stateOf(page)
  return {
    stuck,
    facts: state.facts,
    items: state.items,
    ended: Object.keys(state.events)
      .filter((key) => key.startsWith('cutscene.ended:'))
      .map((key) => key.slice('cutscene.ended:'.length))
      .sort(),
  }
}
