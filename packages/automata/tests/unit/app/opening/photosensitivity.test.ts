import { afterEach, describe, expect, it, vi } from 'vitest'
import { firstRunSteps } from '#src/app/opening/first-run.ts'
import { type OpeningContext, runOpening } from '#src/app/opening/opening.ts'
import { warningStep } from '#src/app/opening/photosensitivity.ts'
import { createSeenFlags } from '#src/app/opening/seen-flags.ts'
import ja from '#src/app/screens/words/ja.json' with { type: 'json' }
import type { Locale } from '#src/features/locale/locale.manager.ts'

// The photosensitivity warning (the second step of the first run): a game that flashes opts in; the first run on a
// device warns once, offers the game's own switches, and Continue, Close and Escape all go on.

const SIX = ['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans']

/** A `Locale` that remembers what it was told. */
function fakeLocale(locales: readonly string[] = SIX) {
  const listeners = new Set<(locale: string) => void>()
  const state = { current: 'en', choice: null as string | null }
  const locale: Locale = {
    locales,
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

let overlay: HTMLElement | undefined
afterEach(() => {
  overlay?.remove()
  overlay = undefined
  vi.unstubAllGlobals()
})

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

function context(options: { locale?: Locale; seen?: ReturnType<typeof createSeenFlags> } = {}) {
  overlay = document.createElement('div')
  document.body.append(overlay)
  const seen = options.seen ?? createSeenFlags(undefined)
  const locale = options.locale ?? fakeLocale()
  const base: Omit<OpeningContext, 'layer'> = {
    services: { hosting: { kind: 'web' }, locale } as unknown as OpeningContext['services'],
    seen,
    signal: new AbortController().signal,
  }
  return { base, seen, locale, overlay }
}

/** Runs the warning step alone and hands back what a test needs to look at and press. */
function startWarning(
  option: Parameters<typeof warningStep>[0],
  options: Parameters<typeof context>[0] = {},
) {
  const ctx = context(options)
  const layer = document.createElement('div')
  ctx.overlay.append(layer)
  let done = false
  const finished = warningStep(option)({ ...ctx.base, layer }).then(() => {
    done = true
  })
  return {
    ...ctx,
    layer,
    finished,
    isDone: () => done,
    continueButton: () => layer.querySelector<HTMLButtonElement>('[data-testid="photosensitivity-continue"]'),
    dialog: () => layer.querySelector('[role="dialog"]'),
  }
}

/** A switch backed by a variable, so a test reads what the warning set. */
function fakeSwitch(
  initial: boolean,
  id = 'less-shaking',
  label: string | ((locale: string) => string) = 'Less shaking',
) {
  const state = { on: initial }
  return {
    state,
    id,
    label,
    get: () => state.on,
    set: (on: boolean) => {
      state.on = on
    },
  }
}

describe('firstRunSteps with a photosensitivity option', () => {
  it('has no warning step for a game that did not opt in', () => {
    expect(firstRunSteps({})).toHaveLength(1)
    expect(firstRunSteps({ firstRunLanguage: false })).toHaveLength(0)
  })

  it('has the language step then the warning step for a game that did', () => {
    expect(firstRunSteps({ photosensitivity: true })).toHaveLength(2)
    expect(firstRunSteps({ firstRunLanguage: false, photosensitivity: true })).toHaveLength(1)
  })
})

describe('the warning step', () => {
  it('on a first run shows the warning in a dialog, with Continue focused', async () => {
    const run = startWarning(true)
    await tick()
    expect(run.dialog()?.textContent).toContain('Flashing lights warning')
    expect(run.dialog()?.textContent).toContain('seizure')
    expect(document.activeElement).toBe(run.continueButton())
    expect(run.isDone()).toBe(false)
  })

  it('Continue marks it seen and goes on', async () => {
    const run = startWarning(true)
    await tick()
    run.continueButton()?.click()
    await run.finished
    expect(run.seen.has('photosensitivity')).toBe(true)
    expect(run.layer.querySelector('[role="dialog"]')).toBeNull()
  })

  it('Escape goes on and marks it seen', async () => {
    const run = startWarning(true)
    await tick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await run.finished
    expect(run.seen.has('photosensitivity')).toBe(true)
  })

  it('Close goes on and marks it seen', async () => {
    const run = startWarning(true)
    await tick()
    run.layer.querySelector<HTMLButtonElement>('[data-modal-close]')?.click()
    await run.finished
    expect(run.seen.has('photosensitivity')).toBe(true)
  })

  it('shows nothing on a device that has seen it', async () => {
    const seen = createSeenFlags(undefined)
    seen.mark('photosensitivity')
    const run = startWarning(true, { seen })
    await run.finished
    expect(run.layer.children).toHaveLength(0)
  })

  it('says whether the device asks for reduced motion', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query }))
    const run = startWarning(true)
    await tick()
    expect(run.dialog()?.textContent).toContain('Reduced motion is on')
  })

  it('offers no switches group when the game passes none', async () => {
    const run = startWarning(true)
    await tick()
    expect(run.layer.querySelector('[data-warning-switches]')).toBeNull()
  })

  it('a switch calls set at once, and keeps its value after Continue', async () => {
    const less = fakeSwitch(false)
    const run = startWarning({ switches: [less] })
    await tick()
    const toggle = run.layer.querySelector<HTMLInputElement>(
      `[data-testid="warning-switch-${less.id}"] input`,
    )
    expect(toggle).not.toBeNull()
    expect(toggle?.checked).toBe(false)
    toggle?.click()
    expect(less.state.on).toBe(true)
    run.continueButton()?.click()
    await run.finished
    expect(less.state.on).toBe(true)
  })

  it('a switch starts as the game says it is', async () => {
    const run = startWarning({ switches: [fakeSwitch(true)] })
    await tick()
    expect(
      run.layer.querySelector<HTMLInputElement>('[data-testid="warning-switch-less-shaking"] input')?.checked,
    ).toBe(true)
  })

  it('a switch label that is a function is said in the player’s language', async () => {
    const locale = fakeLocale()
    locale.set('ja')
    const less = fakeSwitch(false, 'less-shaking', (tag) => (tag === 'ja' ? '揺れを減らす' : 'Less shaking'))
    const run = startWarning({ switches: [less] }, { locale })
    await tick()
    expect(run.dialog()?.textContent).toContain('揺れを減らす')
  })

  it('an aborted signal ends the step', async () => {
    const ctx = context()
    const abort = new AbortController()
    const layer = document.createElement('div')
    ctx.overlay.append(layer)
    const finished = warningStep(true)({ ...ctx.base, layer, signal: abort.signal })
    await tick()
    abort.abort()
    await finished
    expect(layer.querySelector('[role="dialog"]')).toBeNull()
  })
})

describe('the first run in order', () => {
  it('language first, then the warning in the language just picked', async () => {
    const ctx = context()
    const run = runOpening(firstRunSteps({ photosensitivity: true }), ctx.base, ctx.overlay, () => undefined)
    await tick()
    expect(ctx.overlay.querySelector('[data-testid="first-language-ja"]')).not.toBeNull()
    expect(ctx.overlay.querySelector('[data-testid="photosensitivity-continue"]')).toBeNull()
    ctx.overlay.querySelector<HTMLButtonElement>('[data-testid="first-language-ja"]')?.click()
    await tick()
    expect(ctx.overlay.querySelector('[data-testid^="first-language-"]')).toBeNull()
    expect(ctx.overlay.querySelector('[role="dialog"]')?.textContent).toContain(ja.first_run_warning_title)
    expect(ctx.overlay.querySelector('[role="dialog"]')?.textContent).not.toContain('Flashing lights warning')
    ctx.overlay.querySelector<HTMLButtonElement>('[data-testid="photosensitivity-continue"]')?.click()
    await run
    expect(ctx.seen.has('language')).toBe(true)
    expect(ctx.seen.has('photosensitivity')).toBe(true)
  })

  it('a game with one language goes straight to the warning', async () => {
    const ctx = context({ locale: fakeLocale(['en']) })
    const run = runOpening(firstRunSteps({ photosensitivity: true }), ctx.base, ctx.overlay, () => undefined)
    await tick()
    expect(ctx.overlay.querySelector('[data-testid="photosensitivity-continue"]')).not.toBeNull()
    ctx.overlay.querySelector<HTMLButtonElement>('[data-testid="photosensitivity-continue"]')?.click()
    await run
  })
})
