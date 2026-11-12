import { fakeClock } from '@automataframework/framework/testing'
import { cleanup, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { splashStep } from '#src/app/splash-step.ts'
import SplashScreen from '#src/features/splash/SplashScreen.svelte'
import { screensWords } from '#src/shared/words/screens-words.ts'

// The splash is an opening step: the studio's logo, held for a moment on the runtime's clock and ended early by any
// key, click or tap. It never plays a sound, never waits for the host and never outlives the runtime.

const LOGO = { src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', alt: 'Moss Studio' }

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
})

/** What an opening step is given, with a clock the test winds and a locale that says only what it speaks. */
function start(options: Partial<Parameters<typeof splashStep>[0]> = {}, locale = 'en') {
  const layer = document.createElement('div')
  document.body.append(layer)
  const clock = fakeClock()
  const abort = new AbortController()
  let settled = 0
  const done = splashStep({ logo: LOGO, ...options })({
    layer,
    services: { clock, locale: { current: locale } },
    seen: { has: () => false, mark: () => {} },
    signal: abort.signal,
  } as never).then(() => void settled++)
  return { layer, clock, abort, done, settled: () => settled }
}

/** Lets the step's promise callbacks run. */
const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve))

describe('splashStep', () => {
  it('resolves after holdMs on the injected clock, not before', async () => {
    const { clock, settled } = start()
    clock.advance(1499)
    await flush()
    expect(settled()).toBe(0)
    clock.advance(1)
    await flush()
    expect(settled()).toBe(1)
  })

  it('holds for as long as the game asks', async () => {
    const { clock, settled } = start({ holdMs: 300 })
    clock.advance(299)
    await flush()
    expect(settled()).toBe(0)
    clock.advance(1)
    await flush()
    expect(settled()).toBe(1)
  })

  it.each([
    ['a keydown', () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))],
    [
      'a pointerdown',
      () =>
        document
          .querySelector('[data-game-screen="splash"]')
          ?.dispatchEvent(new Event('pointerdown', { bubbles: true })),
    ],
    ['a click', () => document.querySelector<HTMLElement>('[data-game-screen="splash"]')?.click()],
  ])('%s ends it early', async (_name, press) => {
    const { settled } = start()
    await flush()
    press()
    await flush()
    expect(settled()).toBe(1)
  })

  it('resolves once when a press and the timer both fire', async () => {
    const { clock, layer, settled } = start()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    clock.advance(5000)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    await flush()
    expect(settled()).toBe(1)
    expect(layer.querySelector('[data-game-screen="splash"]')).toBeNull()
  })

  it('stops listening to the page once it is over', async () => {
    const { clock, settled, layer } = start({ holdMs: 10 })
    clock.advance(10)
    await flush()
    expect(settled()).toBe(1)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    expect(layer.children.length).toBe(0)
  })

  it('shows the logo with its alt text and the skip line in the locale’s words', () => {
    const { layer } = start()
    expect(layer.querySelector('img')).toHaveAttribute('alt', 'Moss Studio')
    expect(layer.querySelector('img')).toHaveAttribute('src', LOGO.src)
    expect(layer).toHaveTextContent('Press any key or tap to skip')
  })

  it('takes the game’s own words over the package’s', () => {
    const { layer } = start({ copy: { skip: 'Tap, tap' } })
    expect(layer).toHaveTextContent('Tap, tap')
    expect(layer).not.toHaveTextContent('Press any key')
  })

  it('takes a function of the locale as its words', () => {
    const { layer } = start({ copy: (locale) => ({ skip: `skip in ${locale}` }) }, 'ko')
    expect(layer).toHaveTextContent('skip in ko')
  })

  it('an aborted signal resolves it and removes the screen', async () => {
    const { abort, settled, layer } = start()
    abort.abort()
    await flush()
    expect(settled()).toBe(1)
    expect(layer.querySelector('[data-game-screen="splash"]')).toBeNull()
  })

  it('resolves at once, showing nothing, when the signal is already aborted', async () => {
    const layer = document.createElement('div')
    const abort = new AbortController()
    abort.abort()
    await splashStep({ logo: LOGO })({
      layer,
      services: { clock: fakeClock(), locale: { current: 'en' } },
      seen: { has: () => false, mark: () => {} },
      signal: abort.signal,
    } as never)
    expect(layer.children.length).toBe(0)
  })

  it('plays no sound', () => {
    // The step is given no audio service to play with; a step that reached for one would throw and be skipped.
    expect(() => start()).not.toThrow()
  })

  it.each(['ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans'])('the default words follow the locale: %s', (locale) => {
    const { layer } = start({}, locale)
    expect(layer).toHaveTextContent(screensWords(locale).splash.skip)
    expect(screensWords(locale).splash.skip).not.toBe(screensWords('en').splash.skip)
  })
})

describe('screensWords', () => {
  it('speaks English for a language it does not have', () => {
    expect(screensWords('fr').splash.skip).toBe('Press any key or tap to skip')
  })

  it('matches on the primary subtag, as the game’s own locale does', () => {
    expect(screensWords('pt').splash.skip).toBe(screensWords('pt-BR').splash.skip)
    expect(screensWords('zh-CN').splash.skip).toBe(screensWords('zh-Hans').splash.skip)
    expect(screensWords('es-MX').splash.skip).toBe(screensWords('es-419').splash.skip)
  })
})

describe('SplashScreen', () => {
  it('draws the logo and the skip line, and says nothing else', () => {
    render(SplashScreen, { logo: LOGO, copy: { skip: 'Tap to skip' }, onDone: () => {} })
    expect(screen.getByRole('img', { name: 'Moss Studio' })).toBeInTheDocument()
    expect(screen.getByText('Tap to skip')).toBeInTheDocument()
  })

  it('tells the page it is the splash, so a host can tell what it is looking at', () => {
    const { container } = render(SplashScreen, {
      logo: LOGO,
      copy: { skip: 'Tap to skip' },
      onDone: () => {},
    })
    expect(container.querySelector('[data-game-screen="splash"]')).not.toBeNull()
  })
})
