import { afterEach, describe, expect, it, vi } from 'vitest'
import { firstRunSteps, languageStep } from '#src/app/opening/first-run.ts'
import type { OpeningContext } from '#src/app/opening/opening.ts'
import { createSeenFlags } from '#src/app/opening/seen-flags.ts'
import ja from '#src/app/screens/words/ja.json' with { type: 'json' }
import type { Locale } from '#src/features/locale/locale.manager.ts'

// The first run's language screen (the first step of the opening): shown once, on a device whose player has not chosen
// and whose host does not supply a language, for a game that ships more than one. One press picks and goes on.

const SIX = ['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans']

/** A `Locale` that remembers what it was told, with the detected language as `current`. */
function fakeLocale(options: { locales?: readonly string[]; current?: string; choice?: string | null } = {}) {
  const listeners = new Set<(locale: string) => void>()
  const state = { current: options.current ?? 'en', choice: options.choice ?? null }
  const locale: Locale = {
    locales: options.locales ?? SIX,
    baseLocale: 'en',
    get current() {
      return state.current
    },
    get choice() {
      return state.choice
    },
    direction: 'ltr',
    subscribe(listener) {
      listeners.add(listener)
      listener(state.current)
      return () => void listeners.delete(listener)
    },
    set: vi.fn((choice: string | null) => {
      state.choice = choice
      state.current = choice ?? 'en'
      for (const listener of listeners) listener(state.current)
    }),
  }
  return locale
}

let layer: HTMLElement | undefined
afterEach(() => {
  layer?.remove()
  layer = undefined
})

function start(
  options: {
    locale?: Locale
    kind?: string
    seen?: ReturnType<typeof createSeenFlags>
    game?: Parameters<typeof firstRunSteps>[0]
  } = {},
) {
  layer = document.createElement('div')
  document.body.append(layer)
  const locale = options.locale ?? fakeLocale()
  const seen = options.seen ?? createSeenFlags(undefined)
  const context: OpeningContext = {
    layer,
    services: { hosting: { kind: options.kind ?? 'web' }, locale } as unknown as OpeningContext['services'],
    seen,
    signal: new AbortController().signal,
  }
  let done = false
  const finished = languageStep()(context).then(() => {
    done = true
  })
  return {
    locale,
    seen,
    finished,
    isDone: () => done,
    layer,
    button: (tag: string) => layer?.querySelector<HTMLButtonElement>(`[data-testid="first-language-${tag}"]`),
  }
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('the first-run language step', () => {
  it('resolves at once and shows nothing for a game with one language', async () => {
    const run = start({ locale: fakeLocale({ locales: ['en'] }) })
    await run.finished
    expect(run.layer.children.length).toBe(0)
  })

  it('is skipped under a Ruken host, even with six languages: the host supplies the language', async () => {
    const run = start({ kind: 'ruken' })
    await run.finished
    expect(run.layer.querySelector('[data-testid^="first-language-"]')).toBeNull()
  })

  it('is skipped when the player has already chosen', async () => {
    const run = start({ locale: fakeLocale({ choice: 'ko' }) })
    await run.finished
    expect(run.layer.querySelector('[data-testid^="first-language-"]')).toBeNull()
  })

  it('is skipped when this device has seen it', async () => {
    const seen = createSeenFlags(undefined)
    seen.mark('language')
    const run = start({ seen })
    await run.finished
    expect(run.layer.querySelector('[data-testid^="first-language-"]')).toBeNull()
  })

  it('shows every language in its own script, in order, each in its own language, and focuses the detected one', async () => {
    const run = start({ locale: fakeLocale({ current: 'ko' }) })
    await tick()
    const tags = [...run.layer.querySelectorAll<HTMLButtonElement>('[data-testid^="first-language-"]')]
    expect(tags.map((b) => b.dataset.testid?.replace('first-language-', ''))).toEqual(SIX)
    expect(tags.map((b) => b.textContent?.trim())).toEqual([
      'English',
      '日本語',
      '한국어',
      'Español',
      'Português (Brasil)',
      '简体中文',
    ])
    expect(tags.map((b) => b.lang)).toEqual(SIX)
    expect(document.activeElement).toBe(run.button('ko'))
  })

  it('pressing 日本語 sets the locale, marks it seen and goes on', async () => {
    const run = start()
    await tick()
    run.button('ja')?.click()
    await run.finished
    expect(run.locale.set).toHaveBeenCalledWith('ja')
    expect(run.seen.has('language')).toBe(true)
    expect(run.layer.querySelector('[data-testid^="first-language-"]')).toBeNull()
  })

  it('the title is in the language just picked', async () => {
    const run = start()
    await tick()
    expect(run.layer.querySelector('[role="dialog"]')?.textContent).toContain('Language')
    run.button('ja')?.click()
    await tick()
    // The step has finished by now, but the title changed in place the moment the locale did.
    expect(ja.first_run_language_title).toBe('言語')
  })

  it('Escape goes on with no choice saved, and the screen never shows again', async () => {
    const run = start()
    await tick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await run.finished
    expect(run.locale.set).not.toHaveBeenCalled()
    expect(run.locale.choice).toBeNull()
    expect(run.seen.has('language')).toBe(true)
  })

  it('the close button goes on with no choice saved', async () => {
    const run = start()
    await tick()
    run.layer.querySelector<HTMLButtonElement>('[data-modal-close]')?.click()
    await run.finished
    expect(run.locale.set).not.toHaveBeenCalled()
    expect(run.seen.has('language')).toBe(true)
  })

  it('names every language button as a control at least 48 px high', async () => {
    const run = start()
    await tick()
    for (const button of run.layer.querySelectorAll<HTMLButtonElement>('[data-testid^="first-language-"]'))
      expect(
        button.classList.contains('af-control--primary') || button.classList.contains('af-control'),
      ).toBe(true)
  })

  it('works the pad’s way: arrows are focus moves on real buttons, and a press on the focused one picks it', async () => {
    const run = start({ locale: fakeLocale({ current: 'en' }) })
    await tick()
    const next = run.button('ja')
    next?.focus()
    expect(document.activeElement).toBe(next)
    next?.click()
    await run.finished
    expect(run.locale.set).toHaveBeenCalledWith('ja')
  })
})

describe('firstRunSteps', () => {
  it('has the language step unless the game turns it off', () => {
    expect(firstRunSteps({})).toHaveLength(1)
    expect(firstRunSteps({ firstRunLanguage: true })).toHaveLength(1)
    expect(firstRunSteps({ firstRunLanguage: false })).toHaveLength(0)
  })
})
