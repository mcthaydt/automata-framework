// @vitest-environment jsdom

import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { LineBox } from '#src/entries/index.ts'

// The one box a line is drawn in: the dialogue box reads a conversation into it, and the HUD's examine piece feeds it a
// line of its own. It is only a box: a speaker or title, the words and whatever controls its caller puts inside.

let instance: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (instance !== undefined) void unmount(instance)
  instance = undefined
  document.body.replaceChildren()
})

function draw(props: { speaker?: string; text: string; placed?: boolean; style?: string }): HTMLElement {
  instance = mount(LineBox, { target: document.body, props })
  flushSync()
  return document.querySelector<HTMLElement>('[data-testid=dialogue-box]') as HTMLElement
}

describe('the line box', () => {
  it('shows a speaker and the words', () => {
    const box = draw({ speaker: 'Porter', text: 'Cold tonight.' })
    expect(box.querySelector('[data-testid=dialogue-speaker]')?.textContent).toBe('Porter')
    expect(box.querySelector('[data-testid=dialogue-line]')?.textContent).toBe('Cold tonight.')
  })

  it('shows no speaker line when there is none', () => {
    const box = draw({ text: 'A cupboard, empty.' })
    expect(box.querySelector('[data-testid=dialogue-speaker]')).toBeNull()
  })

  it('is placed by its caller when it is told so, and keeps the caller’s style', () => {
    const box = draw({ text: 'Hello.', placed: true, style: 'position: absolute; top: 4px;' })
    expect(box.classList.contains('placed')).toBe(true)
    expect(box.getAttribute('style')).toContain('top: 4px')
  })
})
