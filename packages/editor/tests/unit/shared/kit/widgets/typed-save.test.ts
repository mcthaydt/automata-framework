// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createTypingDrafts, TYPING_DELAY_MS } from '#src/shared/kit/storage/typing-drafts.ts'
import { typedSave } from '#src/shared/kit/widgets/typed-save.ts'

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

function setup(initial = 'old') {
  const timers = fakeTimers()
  const drafts = createTypingDrafts({ timers, scope: 'game' })
  const input = document.createElement('input')
  document.body.append(input)
  const committed: string[] = []
  const params = (value: string) => ({ drafts, value, commit: (raw: string) => void committed.push(raw) })
  const action = typedSave(input, params(initial))
  const type = (text: string) => {
    input.value = text
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
  return { input, timers, drafts, committed, action, type, params }
}

describe('typedSave', () => {
  it('shows the value it is given', () => {
    const { input } = setup('Hello')
    expect(input.value).toBe('Hello')
  })

  it('commits half a second after the last key, with the focus still in the field', () => {
    const { input, timers, committed, type } = setup()
    input.focus()
    type('Hello grandma')
    expect(committed).toEqual([])
    timers.advance(TYPING_DELAY_MS)
    expect(committed).toEqual(['Hello grandma'])
    expect(document.activeElement).toBe(input)
  })

  it('commits at once when the field is left, and not twice', () => {
    const { input, timers, committed, type } = setup()
    input.focus()
    type('abc')
    input.dispatchEvent(new Event('blur'))
    timers.advance(TYPING_DELAY_MS)
    expect(committed).toEqual(['abc'])
  })

  it('commits on Ctrl+Enter and on Cmd+Enter', () => {
    for (const modifier of ['ctrlKey', 'metaKey'] as const) {
      const { input, committed, type } = setup()
      input.focus()
      type('abc')
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', [modifier]: true }))
      input.dispatchEvent(new Event('blur'))
      expect(committed).toEqual(['abc'])
    }
  })

  it('does not put the old value back into a field being typed in', () => {
    const { input, action, type, params } = setup('old')
    input.focus()
    type('Hello gra')
    // The commit of "Hello" landed, so the editor hands back "Hello" while "Hello gra" is on the screen.
    action.update?.(params('Hello'))
    expect(input.value).toBe('Hello gra')
  })

  it('shows a new value when the field is not being typed in', () => {
    const { input, action, params } = setup('old')
    action.update?.(params('changed by Undo'))
    expect(input.value).toBe('changed by Undo')
  })

  it('commits what waits, and stops listening, when it is destroyed', () => {
    const { input, timers, committed, action, type, drafts } = setup()
    input.focus()
    type('abc')
    action.destroy?.()
    expect(committed).toEqual(['abc'])
    timers.advance(TYPING_DELAY_MS)
    type('later')
    timers.advance(TYPING_DELAY_MS)
    expect(committed).toEqual(['abc'])
    expect(drafts.waiting).toBe(0)
  })
})
