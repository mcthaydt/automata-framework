import { fireEvent, render } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DemoRunner from '#src/features/home/DemoRunner.svelte'
import { DEMO_BAR } from '#src/features/home/home-content.ts'

const props = {
  src: '/demos/emberwick/index.html',
  poster: '/previews/emberwick.jpg',
  posterAlt: 'Emberwick: a hooded hero below grassy stone ledges at night',
  bar: DEMO_BAR,
}

// DemoRunner runs Emberwick on Home: the poster edge to edge, and one bar under it.
describe('DemoRunner', () => {
  it('shows the poster and one Play it button, which is not a second lime primary on the page', () => {
    const view = render(DemoRunner, { props })
    expect(view.getByTestId('demo-runner-container')).toBeTruthy()
    expect(view.queryByRole('button', { name: 'Full screen' })).toBeNull()
    expect(view.queryByRole('button', { name: 'Stop' })).toBeNull()
    expect(view.getAllByRole('button').map((button) => button.textContent?.trim())).toEqual(['Play it'])
    expect(view.getByRole('button', { name: 'Play it' }).classList.contains('button')).toBe(false)
  })

  it('swaps Play it for Full screen and Stop once it plays, and has no other control', async () => {
    const view = render(DemoRunner, { props })
    await fireEvent.click(view.getByRole('button', { name: 'Play it' }))
    expect(view.getAllByRole('button').map((button) => button.textContent?.trim())).toEqual([
      'Full screen',
      'Stop',
    ])
    expect(view.queryByRole('link', { name: /new tab/i })).toBeNull()
    expect(view.queryByRole('button', { name: /start over|retry/i })).toBeNull()
  })

  it('starts on mount when a press on Play it was made before the page was hydrated', () => {
    document.documentElement.dataset.playPressed = ''
    const view = render(DemoRunner, { props })
    expect(view.container.querySelector('iframe')).toBeTruthy()
    expect(document.documentElement.dataset.playPressed, 'the mark is used once').toBeUndefined()
  })
})

// The browser gate that clicks every visible button (tests/e2e/gates.ts) found the fullscreen button doing nothing in
// headless WebKit once nothing else on the page was changing: the request is neither granted nor refused. A button
// that answers nothing looks dead, so the page says when the browser has not started fullscreen after a second.
describe('DemoRunner fullscreen button', () => {
  const setup = async (requestFullscreen: (() => Promise<void>) | undefined) => {
    const view = render(DemoRunner, { props })
    await fireEvent.click(view.getByRole('button', { name: 'Play it' }))
    const container = view.getByTestId('demo-runner-container') as unknown as {
      requestFullscreen?: () => Promise<void>
    }
    container.requestFullscreen = requestFullscreen
    return view
  }

  afterEach(() => {
    vi.useRealTimers()
  })

  it('says the browser did not start fullscreen when it never answers within a second', async () => {
    vi.useFakeTimers()
    const { getByRole, queryByText } = await setup(() => new Promise(() => undefined))
    await fireEvent.click(getByRole('button', { name: 'Full screen' }))
    await vi.advanceTimersByTimeAsync(900)
    expect(queryByText(/Full screen didn't start/i)).toBeNull()
    await vi.advanceTimersByTimeAsync(200)
    expect(queryByText(/Full screen didn't start/i)).not.toBeNull()
  })

  it('takes that message back when fullscreen starts after all', async () => {
    vi.useFakeTimers()
    let answer: () => void = () => undefined
    const { getByRole, queryByText } = await setup(
      () =>
        new Promise<void>((resolve) => {
          answer = resolve
        }),
    )
    await fireEvent.click(getByRole('button', { name: 'Full screen' }))
    await vi.advanceTimersByTimeAsync(1100)
    expect(queryByText(/Full screen didn't start/i)).not.toBeNull()
    answer()
    await vi.advanceTimersByTimeAsync(0)
    expect(queryByText(/Full screen didn't start/i)).toBeNull()
  })

  it('keeps saying fullscreen is unavailable when the browser refuses, and says nothing else after', async () => {
    vi.useFakeTimers()
    const { getByRole, queryByText } = await setup(() => Promise.reject(new Error('denied')))
    await fireEvent.click(getByRole('button', { name: 'Full screen' }))
    await vi.advanceTimersByTimeAsync(0)
    expect(queryByText(/Full screen isn't available/i)).not.toBeNull()
    await vi.advanceTimersByTimeAsync(2000)
    expect(queryByText(/Full screen didn't start/i)).toBeNull()
    expect(queryByText(/Full screen isn't available/i)).not.toBeNull()
  })

  it('says it is unavailable at once where the browser has no fullscreen request', async () => {
    const { getByRole, findByText } = await setup(undefined)
    await fireEvent.click(getByRole('button', { name: 'Full screen' }))
    expect(await findByText(/Full screen isn't available/i)).toBeTruthy()
  })

  // The hosted Chromium run that followed failed the same gate on the same button. The gate allows 1.5 s for a visible
  // change, and the page's own answer (the grant, a refusal or the message above) can come later than that when the
  // runner is loaded. So the click itself changes the page: the button is busy until the browser has answered.
  describe('while the browser has not answered', () => {
    it('marks the button busy in the click itself, before any timer runs', async () => {
      vi.useFakeTimers()
      const { getByRole, getByTestId } = await setup(() => new Promise(() => undefined))
      const seen = vi.fn()
      new MutationObserver(seen).observe(getByTestId('demo-runner-container'), {
        attributes: true,
        subtree: true,
        childList: true,
        characterData: true,
      })
      const button = getByRole('button', { name: 'Full screen' })
      expect(button.hasAttribute('aria-busy')).toBe(false)
      await fireEvent.click(button)
      await Promise.resolve()
      expect(button.getAttribute('aria-busy')).toBe('true')
      expect(seen).toHaveBeenCalled()
    })

    it('stops being busy when fullscreen starts', async () => {
      vi.useFakeTimers()
      let answer: () => void = () => undefined
      const { getByRole } = await setup(
        () =>
          new Promise<void>((resolve) => {
            answer = resolve
          }),
      )
      const button = getByRole('button', { name: 'Full screen' })
      await fireEvent.click(button)
      expect(button.getAttribute('aria-busy')).toBe('true')
      answer()
      await vi.advanceTimersByTimeAsync(0)
      expect(button.hasAttribute('aria-busy')).toBe(false)
    })

    it('stops being busy when the browser refuses, and when it never answers', async () => {
      vi.useFakeTimers()
      const refused = await setup(() => Promise.reject(new Error('denied')))
      const refusedButton = refused.getByRole('button', { name: 'Full screen' })
      await fireEvent.click(refusedButton)
      await vi.advanceTimersByTimeAsync(0)
      expect(refusedButton.hasAttribute('aria-busy')).toBe(false)
      refused.unmount()

      const silent = await setup(() => new Promise(() => undefined))
      const silentButton = silent.getByRole('button', { name: 'Full screen' })
      await fireEvent.click(silentButton)
      expect(silentButton.getAttribute('aria-busy')).toBe('true')
      await vi.advanceTimersByTimeAsync(1100)
      expect(silentButton.hasAttribute('aria-busy')).toBe(false)
      expect(silent.queryByText(/Full screen didn't start/i)).not.toBeNull()
    })
  })
})
