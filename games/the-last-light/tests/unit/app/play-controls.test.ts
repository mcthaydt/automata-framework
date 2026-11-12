// @vitest-environment jsdom
import { mountInPlay, type PlayMount } from '@automata/framework/testing'
import { PuzzleState } from '@automata/puzzle/sim'
import { flushSync } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import PlayControls from '#src/app/PlayControls.svelte'
import { boot } from '#src/testing/harness.ts'

// The Lamp and Skip buttons are for a finger. A player on a keyboard or a pad has F and X (hold) and the pad's buttons, and a
// button drawn over their frame is clutter: input mode decides, and layout does not.

let mounted: PlayMount | undefined
afterEach(() => {
  mounted?.unmount()
  mounted = undefined
})

/** The overlay over a running game, the player's hands being `method`. */
async function overlay(method: 'touch' | 'keyboard' | 'gamepad', state: 'cutscene' | 'lamp') {
  const game = await boot(1, undefined, { opening: state === 'cutscene' })
  if (state === 'lamp') game.sim.resource(PuzzleState).items.push('handLamp')
  mounted = mountInPlay(PlayControls, game.sim, undefined, method)
  flushSync()
  const has = (id: string) => mounted?.host.querySelector(`[data-testid=${id}]`) !== null
  return { skip: has('play-skip'), lamp: has('play-lamp') }
}

describe('the overlay’s buttons', () => {
  it('show Skip during a cutscene under touch, and not under a keyboard or a pad', async () => {
    expect(await overlay('touch', 'cutscene')).toEqual({ skip: true, lamp: false })
    mounted?.unmount()
    expect(await overlay('keyboard', 'cutscene')).toEqual({ skip: false, lamp: false })
    mounted?.unmount()
    expect(await overlay('gamepad', 'cutscene')).toEqual({ skip: false, lamp: false })
  })

  it('show Lamp once Ada holds it under touch, and not under a keyboard or a pad', async () => {
    expect(await overlay('touch', 'lamp')).toEqual({ skip: false, lamp: true })
    mounted?.unmount()
    expect(await overlay('keyboard', 'lamp')).toEqual({ skip: false, lamp: false })
    mounted?.unmount()
    expect(await overlay('gamepad', 'lamp')).toEqual({ skip: false, lamp: false })
  })

  it('come and go as the player takes up a finger or a keyboard', async () => {
    await overlay('touch', 'lamp')
    expect(mounted?.host.querySelector('[data-testid=play-lamp]')).not.toBeNull()
    mounted?.noteInputMethod('keyboard')
    flushSync()
    expect(mounted?.host.querySelector('[data-testid=play-lamp]')).toBeNull()
    mounted?.noteInputMethod('touch')
    flushSync()
    expect(mounted?.host.querySelector('[data-testid=play-lamp]')).not.toBeNull()
  })
})
