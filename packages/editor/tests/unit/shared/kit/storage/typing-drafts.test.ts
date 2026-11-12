import { describe, expect, it } from 'vitest'
import {
  createTypingDrafts,
  type DraftStorage,
  TYPING_DELAY_MS,
} from '#src/shared/kit/storage/typing-drafts.ts'

/** Timers the test moves by hand. */
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
    count: () => waiting.size,
  }
}

function fakeStorage(): DraftStorage & { entries: Map<string, string> } {
  const entries = new Map<string, string>()
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, value),
    removeItem: (key) => void entries.delete(key),
  }
}

function setup(options: { drafts?: DraftStorage | undefined } = {}) {
  const timers = fakeTimers()
  const drafts = createTypingDrafts({ timers, drafts: options.drafts, scope: 'game' })
  return { timers, drafts }
}

describe('a typing field', () => {
  it('commits the last text once, half a second after the last input', () => {
    const { drafts, timers } = setup()
    const committed: string[] = []
    const field = drafts.field((value) => void committed.push(value))
    field.typed('a')
    timers.advance(TYPING_DELAY_MS - 1)
    field.typed('ab')
    timers.advance(TYPING_DELAY_MS - 1)
    expect(committed).toEqual([])
    timers.advance(1)
    expect(committed).toEqual(['ab'])
  })

  it('commits at once when it is left, and not again for the same text', () => {
    const { drafts, timers } = setup()
    const committed: string[] = []
    const field = drafts.field((value) => void committed.push(value))
    field.typed('ab')
    field.left('ab')
    expect(committed).toEqual(['ab'])
    expect(timers.count()).toBe(1) // only the "typing now" timer is left; the commit timer is gone
    timers.advance(5000)
    expect(committed).toEqual(['ab'])
  })

  it('does not commit the same text twice when it is left after a pause', () => {
    const { drafts, timers } = setup()
    const committed: string[] = []
    const field = drafts.field((value) => void committed.push(value))
    field.typed('ab')
    timers.advance(TYPING_DELAY_MS)
    field.left('ab')
    expect(committed).toEqual(['ab'])
  })

  it('commits what was typed after a pause as well', () => {
    const { drafts, timers } = setup()
    const committed: string[] = []
    const field = drafts.field((value) => void committed.push(value))
    field.typed('ab')
    timers.advance(TYPING_DELAY_MS)
    field.typed('abc')
    field.left('abc')
    expect(committed).toEqual(['ab', 'abc'])
  })

  it('commits a text typed again after the field was left and entered again', () => {
    const { drafts } = setup()
    const committed: string[] = []
    const field = drafts.field((value) => void committed.push(value))
    field.typed('ab')
    field.left('ab')
    field.typed('ab')
    field.left('ab')
    expect(committed).toEqual(['ab', 'ab'])
  })

  it('keeps a value the field refuses while typing, and does not commit it', () => {
    const { drafts, timers } = setup()
    const committed: string[] = []
    const field = drafts.field((value) => void committed.push(value), { valid: (value) => value !== '0.' })
    field.typed('0.')
    timers.advance(TYPING_DELAY_MS * 4)
    expect(committed).toEqual([])
    field.typed('0.5')
    timers.advance(TYPING_DELAY_MS)
    expect(committed).toEqual(['0.5'])
  })

  it('still commits a refused value when the field is left, so the field can say why', () => {
    const { drafts } = setup()
    const committed: string[] = []
    const field = drafts.field((value) => void committed.push(value), { valid: () => false })
    field.typed('x')
    field.left('x')
    expect(committed).toEqual(['x'])
  })

  it('tries a text the field refused again when the person leaves, saying leaving this time', () => {
    const { drafts, timers } = setup()
    const calls: [string, boolean][] = []
    const field = drafts.field((value, leaving) => {
      calls.push([value, leaving])
      return false
    })
    field.typed('nope')
    timers.advance(TYPING_DELAY_MS)
    field.left('nope')
    expect(calls).toEqual([
      ['nope', false],
      ['nope', true],
    ])
  })

  it('commits a leave-only field on leave and on flush, never on a pause', () => {
    const { drafts, timers } = setup()
    const committed: string[] = []
    const field = drafts.field((value) => void committed.push(value), { leaveOnly: true })
    field.typed('Gu')
    timers.advance(TYPING_DELAY_MS * 4)
    expect(committed).toEqual([])
    field.typed('Guard')
    drafts.flush()
    expect(committed).toEqual(['Guard'])
    field.typed('Guard 2')
    field.left('Guard 2')
    expect(committed).toEqual(['Guard', 'Guard 2'])
  })

  it('flushes every waiting field and cancels their timers', () => {
    const { drafts, timers } = setup()
    const one: string[] = []
    const two: string[] = []
    drafts.field((value) => void one.push(value)).typed('one')
    drafts.field((value) => void two.push(value)).typed('two')
    drafts.flush()
    expect(one).toEqual(['one'])
    expect(two).toEqual(['two'])
    expect(timers.count()).toBe(1) // only the "typing now" timer is left; the commit timers are gone
    expect(drafts.waiting).toBe(0)
  })

  it('counts the fields with typed text and tells its listeners', () => {
    const { drafts, timers } = setup()
    const heard: number[] = []
    drafts.subscribe(() => heard.push(drafts.waiting))
    const field = drafts.field(() => undefined)
    field.typed('a')
    field.typed('ab')
    expect(drafts.waiting).toBe(1)
    timers.advance(TYPING_DELAY_MS)
    expect(drafts.waiting).toBe(0)
    expect(heard).toContain(1)
    expect(heard.at(-1)).toBe(0)
  })

  it('commits what is waiting when the field is taken away, so a switch of editor loses nothing', () => {
    const { drafts, timers } = setup()
    const committed: string[] = []
    const field = drafts.field((value) => void committed.push(value))
    field.typed('a')
    field.dispose()
    timers.advance(TYPING_DELAY_MS)
    expect(committed).toEqual(['a'])
    expect(drafts.waiting).toBe(0)
  })
})

describe('typing now', () => {
  it('is true from the first key until 3 seconds after the last, even once the words are written', () => {
    const { drafts, timers } = setup()
    const field = drafts.field(() => undefined)
    let told = 0
    drafts.subscribe(() => told++)
    expect(drafts.typing).toBe(false)
    field.typed('a')
    expect(drafts.typing).toBe(true)
    timers.advance(TYPING_DELAY_MS)
    expect(drafts.waiting).toBe(0)
    expect(drafts.typing).toBe(true)
    timers.advance(2000)
    field.typed('ab')
    timers.advance(2999)
    expect(drafts.typing).toBe(true)
    const before = told
    timers.advance(1)
    expect(drafts.typing).toBe(false)
    expect(told).toBeGreaterThan(before)
  })
})

describe('drafts kept for a closed page', () => {
  it('writes the text to storage on every input, before any timer, and removes it once the write has finished', () => {
    const storage = fakeStorage()
    const { drafts, timers } = setup({ drafts: storage })
    const field = drafts.field(() => undefined, { key: 'writer/line', current: () => 'old' })
    field.typed('n')
    expect(storage.entries.size).toBe(1)
    expect(JSON.parse([...storage.entries.values()][0] ?? '')).toMatchObject({ value: 'n', base: 'old' })
    timers.advance(TYPING_DELAY_MS)
    // The commit started a write; a page that goes away now has not kept the words, so the draft stays.
    expect(storage.entries.size).toBe(1)
    drafts.wrote(false)
    expect(storage.entries.size).toBe(1)
    drafts.wrote(true)
    expect(storage.entries.size).toBe(0)
  })

  it('keeps the first text as the base the draft was typed over', () => {
    const storage = fakeStorage()
    const { drafts } = setup({ drafts: storage })
    let current = 'old'
    const field = drafts.field(() => undefined, { key: 'k', current: () => current, leaveOnly: true })
    field.typed('a')
    current = 'moved'
    field.typed('ab')
    expect(JSON.parse([...storage.entries.values()][0] ?? '')).toMatchObject({ value: 'ab', base: 'old' })
  })

  it('commits the draft a closed page left when the same field opens again', async () => {
    const storage = fakeStorage()
    const first = setup({ drafts: storage })
    first.drafts.field(() => undefined, { key: 'writer/line', current: () => 'old' }).typed('Typed words')
    // The page went away before the commit landed: a new page, a new registry, the file still reads "old".
    const second = setup({ drafts: storage })
    const committed: string[] = []
    second.drafts.field((value) => void committed.push(value), { key: 'writer/line', current: () => 'old' })
    await Promise.resolve()
    expect(committed).toEqual(['Typed words'])
    // Still a draft until the write it started has finished.
    expect(storage.entries.size).toBe(1)
    second.drafts.wrote()
    expect(storage.entries.size).toBe(0)
  })

  it('drops a draft whose file already reads the typed text, or has moved on', async () => {
    const storage = fakeStorage()
    const first = setup({ drafts: storage })
    first.drafts.field(() => undefined, { key: 'a', current: () => 'old' }).typed('new')
    first.drafts.field(() => undefined, { key: 'b', current: () => 'old' }).typed('other')
    const second = setup({ drafts: storage })
    const committed: string[] = []
    second.drafts.field((value) => void committed.push(value), { key: 'a', current: () => 'new' })
    second.drafts.field((value) => void committed.push(value), { key: 'b', current: () => 'somebody else' })
    await Promise.resolve()
    expect(committed).toEqual([])
    expect(storage.entries.size).toBe(0)
  })

  it('keeps two games apart', async () => {
    const storage = fakeStorage()
    const timers = fakeTimers()
    const one = createTypingDrafts({ timers, drafts: storage, scope: 'game-one' })
    one.field(() => undefined, { key: 'k', current: () => 'old' }).typed('mine')
    const two = createTypingDrafts({ timers, drafts: storage, scope: 'game-two' })
    const committed: string[] = []
    two.field((value) => void committed.push(value), { key: 'k', current: () => 'old' })
    await Promise.resolve()
    expect(committed).toEqual([])
  })

  it('keeps two editors apart when their fields share a key', async () => {
    const storage = fakeStorage()
    const first = setup({ drafts: storage })
    first.drafts.place = 'writer'
    first.drafts.field(() => undefined, { key: 'Line', current: () => 'old' }).typed('mine')
    const second = setup({ drafts: storage })
    second.drafts.place = 'feel'
    const committed: string[] = []
    second.drafts.field((value) => void committed.push(value), { key: 'Line', current: () => 'old' })
    await Promise.resolve()
    expect(committed).toEqual([])
  })

  it('works with no storage at all, and with storage that throws', () => {
    const throwing: DraftStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    for (const drafts of [undefined, throwing]) {
      const { drafts: registry, timers } = setup({ drafts })
      const committed: string[] = []
      const field = registry.field((value) => void committed.push(value), { key: 'k', current: () => '' })
      field.typed('a')
      timers.advance(TYPING_DELAY_MS)
      expect(committed).toEqual(['a'])
    }
  })
})

describe('a visit to a field', () => {
  it('opens when a field is entered and keeps its key until the write is seen', () => {
    const { drafts, timers } = setup()
    const field = drafts.field(() => undefined)
    expect(drafts.visit()).toBeUndefined()
    field.entered()
    const key = drafts.visit()
    expect(key).toBeDefined()
    field.typed('a')
    timers.advance(TYPING_DELAY_MS)
    expect(drafts.visit()).toBe(key)
    field.left('a')
    expect(drafts.visit()).toBe(key)
    drafts.wrote()
    expect(drafts.visit()).toBeUndefined()
  })

  it('closes a second after the field was left even if no write is seen', () => {
    const { drafts, timers } = setup()
    const field = drafts.field(() => undefined)
    field.entered()
    field.left('')
    expect(drafts.visit()).toBeDefined()
    timers.advance(1000)
    expect(drafts.visit()).toBeUndefined()
  })

  it('gives the next visit a new key', () => {
    const { drafts } = setup()
    const field = drafts.field(() => undefined)
    field.entered()
    const first = drafts.visit()
    field.left('')
    drafts.wrote()
    field.entered()
    expect(drafts.visit()).not.toBe(first)
  })
})
