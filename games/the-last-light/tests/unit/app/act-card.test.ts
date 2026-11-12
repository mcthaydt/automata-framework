// @vitest-environment jsdom
import { mountInPlay, type PlayMount } from '@automata/framework/testing'
import { flushSync } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import ActCard from '#src/app/ActCard.svelte'
import { ACT_CARD, cardAt } from '#src/app/act-card.ts'
import { boot } from '#src/testing/harness.ts'

// The old game opens each act on a card ("PROLOGUE: FIRST NIGHT") that comes up a second into its first cutscene and goes at 4.5
// seconds, before the scene is under way (`ACT_CARD` in `src/main.ts` at 92e6704). Ours is the same words in the same window,
// over the opening only, from the sim's own clock so a slow renderer shows it as long as a fast one.

let mounted: PlayMount | undefined
afterEach(() => {
  mounted?.unmount()
  mounted = undefined
})

/** The card's words on screen after the opening has run `seconds`, or null when no card is up. */
async function cardAfter(seconds: number, opening = true): Promise<string | null> {
  const game = await boot(1, undefined, { opening })
  game.hold(seconds)
  mounted = mountInPlay(ActCard, game.sim, undefined, 'keyboard')
  flushSync()
  return mounted.host.querySelector('[data-testid=act-card]')?.textContent?.trim() ?? null
}

describe('the act card', () => {
  it('is the prologue’s name, in capitals, from a second into the opening to four and a half', () => {
    expect(ACT_CARD).toMatchObject({ cutscene: 'opening', from: 1, to: 4.5 })
    expect(cardAt({ id: 'opening', start: 0 }, 59)).toBe(false)
    expect(cardAt({ id: 'opening', start: 0 }, 60)).toBe(true)
    expect(cardAt({ id: 'opening', start: 0 }, 269)).toBe(true)
    expect(cardAt({ id: 'opening', start: 0 }, 270)).toBe(false)
    expect(cardAt({ id: 'lightsOut', start: 0 }, 120)).toBe(false)
    expect(cardAt({ id: null, start: 0 }, 120)).toBe(false)
  })

  it('shows on the screen while the opening plays it, and not before or after', async () => {
    expect(await cardAfter(0.5)).toBeNull()
    mounted?.unmount()
    expect(await cardAfter(2)).toBe('PROLOGUE: FIRST NIGHT')
    mounted?.unmount()
    expect(await cardAfter(5)).toBeNull()
  })

  it('is not there in play', async () => {
    expect(await cardAfter(2, false)).toBeNull()
  })
})
