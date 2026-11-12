// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createEnding } from '#src/app/ending.ts'

// The night ends when Ada lies down (the `rest` cutscene): the old prologue went on to act one, which this slice does not have,
// so the credits are shown. Core has no way for a game to send the player back to the title, so the player closes the panel and
// leaves by the pause menu's Back to menu.

const hosting = { granted: new Set<string>(), openLink: async () => ({ ok: false }) } as never
const ended = (id: string, skipped = false) => ({
  type: 'cutscene.ended',
  payload: { id, skipped, missing: [] },
})

let target: HTMLElement
function make(): ReturnType<typeof createEnding> {
  target = document.createElement('div')
  document.body.append(target)
  return createEnding({ target: () => target, hosting })
}
const panels = (): number => target.querySelectorAll('[data-testid=credits-panel]').length

afterEach(() => {
  target?.remove()
})

describe('the ending', () => {
  it('shows the credits when the rest cutscene has ended', () => {
    const ending = make()
    ending.note([ended('rest')])
    expect(panels()).toBe(1)
  })

  it('shows them when the rest cutscene was skipped too', () => {
    const ending = make()
    ending.note([ended('rest', true)])
    expect(panels()).toBe(1)
  })

  it('shows nothing for any other cutscene, not even the one that follows a catch', () => {
    const ending = make()
    ending.note([ended('found'), ended('lightsOut'), ended('opening')])
    expect(panels()).toBe(0)
  })

  it('shows one panel however many times it is told', () => {
    const ending = make()
    ending.note([ended('rest')])
    ending.note([ended('rest')])
    expect(panels()).toBe(1)
  })

  it('takes the panel away when the night starts over', () => {
    const ending = make()
    ending.note([ended('rest')])
    ending.reset()
    expect(panels()).toBe(0)
  })
})
