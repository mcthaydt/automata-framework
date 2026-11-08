// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  createTypingDrafts,
  type DraftStorage,
  TYPING_DELAY_MS,
} from '#src/shared/kit/storage/typing-drafts.ts'
import TypingHost from '#src/testing/kit/TypingHost.svelte'

// P14 for the widgets that type into a text box of their own: a number or a colour typed and not yet left is written
// after a pause, and is offered back to a page that closed with it still in the box.

function fakeTimers() {
  let now = 0
  let next = 0
  const waiting = new Map<number, { at: number; run: () => void }>()
  return {
    after(ms: number, run: () => void) {
      const id = next++
      waiting.set(id, { at: now + ms, run })
      return () => void waiting.delete(id)
    },
    advance(ms: number) {
      now += ms
      for (const [id, timer] of [...waiting]) {
        if (timer.at > now) continue
        waiting.delete(id)
        timer.run()
      }
    },
  }
}

function memoryDrafts(): DraftStorage & { readonly size: number } {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    get size() {
      return map.size
    },
  }
}

function setup(storage = memoryDrafts()) {
  const timers = fakeTimers()
  const drafts = createTypingDrafts({ timers, drafts: storage, scope: 'game' })
  return { timers, drafts, storage }
}

describe('Stepper typing', () => {
  it('writes a typed number after a pause, with the box still open', async () => {
    const { timers, drafts } = setup()
    const heard: number[] = []
    render(TypingHost, { drafts, widget: 'stepper', value: 5, onnumber: (v: number) => heard.push(v) })
    await userEvent.click(screen.getByRole('spinbutton'))
    const box = screen.getByRole('textbox', { name: 'HP' })
    await userEvent.clear(box)
    await userEvent.type(box, '12')
    expect(heard).toEqual([])
    timers.advance(TYPING_DELAY_MS)
    expect(heard).toEqual([12])
    expect(screen.getByRole('textbox', { name: 'HP' })).toBeInTheDocument()
  })

  it('waits while the number is not one yet, and says why when it is left', async () => {
    const { timers, drafts } = setup()
    const heard: number[] = []
    render(TypingHost, { drafts, widget: 'stepper', value: 5, onnumber: (v: number) => heard.push(v) })
    await userEvent.click(screen.getByRole('spinbutton'))
    const box = screen.getByRole('textbox', { name: 'HP' })
    await userEvent.clear(box)
    await userEvent.type(box, '500')
    timers.advance(TYPING_DELAY_MS * 4)
    expect(heard).toEqual([])
    await userEvent.keyboard('{Enter}')
    expect(heard).toEqual([])
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('offers a number typed and left in the box back to the next page', async () => {
    const { drafts, storage } = setup()
    render(TypingHost, { drafts, widget: 'stepper', value: 5 })
    await userEvent.click(screen.getByRole('spinbutton'))
    const box = screen.getByRole('textbox', { name: 'HP' })
    await userEvent.clear(box)
    await userEvent.type(box, '12')
    expect(storage.size).toBe(1)

    const again = setup(storage)
    const heard: number[] = []
    render(TypingHost, {
      drafts: again.drafts,
      widget: 'stepper',
      value: 5,
      onnumber: (v: number) => heard.push(v),
    })
    await Promise.resolve()
    expect(heard).toEqual([12])
  })
})

describe('ColorField typing', () => {
  it('writes a whole hex after a pause without closing the panel, and waits on half of one', async () => {
    const { timers, drafts } = setup()
    const heard: string[] = []
    render(TypingHost, { drafts, widget: 'color', value: '#ff0000', oncolor: (v: string) => heard.push(v) })
    await userEvent.click(screen.getByRole('button', { name: /Tint/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Custom' }))
    const box = screen.getByRole('textbox', { name: 'Tint custom hex' })
    await userEvent.clear(box)
    await userEvent.type(box, '#12')
    timers.advance(TYPING_DELAY_MS)
    expect(heard).toEqual([])
    await userEvent.type(box, '34ab')
    timers.advance(TYPING_DELAY_MS)
    expect(heard).toEqual(['#1234ab'])
    expect(screen.getByRole('textbox', { name: 'Tint custom hex' })).toBeInTheDocument()
  })

  it('offers a hex typed and left in the box back to the next page', async () => {
    const { drafts, storage } = setup()
    render(TypingHost, { drafts, widget: 'color', value: '#ff0000' })
    await userEvent.click(screen.getByRole('button', { name: /Tint/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Custom' }))
    const box = screen.getByRole('textbox', { name: 'Tint custom hex' })
    await userEvent.clear(box)
    await userEvent.type(box, '#1234ab')

    const again = setup(storage)
    const heard: string[] = []
    render(TypingHost, {
      drafts: again.drafts,
      widget: 'color',
      value: '#ff0000',
      oncolor: (v: string) => heard.push(v),
    })
    await Promise.resolve()
    expect(heard).toEqual(['#1234ab'])
  })
})
