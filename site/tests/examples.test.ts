import { fireEvent, render } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DemoRunner from '../src/features/home/DemoRunner.svelte'

// The gallery that used DemoRunner on /examples is gone (WEB.PLAY.5; tests/examples-pages.test.ts covers the new
// pages). DemoRunner still runs Emberwick on / and the first change on /start (PLAY-D10).
describe('DemoRunner', () => {
  it('DemoRunner renders container with controls and iframe element', () => {
    const { getByTestId, getByLabelText } = render(DemoRunner, {
      props: {
        src: '/demos/content/hot-reload/index.html',
        title: 'Content: hot reload',
      },
    })
    expect(getByTestId('demo-runner-container')).toBeTruthy()
    expect(getByLabelText(/Restart demo/i)).toBeTruthy()
    expect(getByLabelText(/Toggle fullscreen/i)).toBeTruthy()
  })

  it('shows only Play until the demo plays, and Play is not a second lime primary on the page', () => {
    const view = render(DemoRunner, {
      props: {
        src: '/demos/emberwick/index.html',
        title: 'Emberwick',
        autoStart: false,
        poster: '/previews/emberwick.jpg',
      },
    })
    expect(view.queryByLabelText(/Restart demo/i)).toBeNull()
    expect(view.queryByLabelText(/Toggle fullscreen/i)).toBeNull()
    const play = view.getByRole('button', { name: 'Play demo' })
    expect(play.classList.contains('button')).toBe(false)
  })
})

// The browser gate that clicks every visible button (tests/e2e/gates.ts) found the fullscreen button doing nothing in
// headless WebKit once nothing else on the page was changing: the request is neither granted nor refused. A button
// that answers nothing looks dead, so the page says when the browser has not started fullscreen after a second.
describe('DemoRunner fullscreen button', () => {
  const props = { src: '/demos/content/hot-reload/index.html', title: 'Content: hot reload' }
  const setup = (requestFullscreen: (() => Promise<void>) | undefined) => {
    const view = render(DemoRunner, { props })
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
    const { getByLabelText, queryByText } = setup(() => new Promise(() => undefined))
    await fireEvent.click(getByLabelText(/Toggle fullscreen/i))
    await vi.advanceTimersByTimeAsync(900)
    expect(queryByText(/Fullscreen did not start/i)).toBeNull()
    await vi.advanceTimersByTimeAsync(200)
    expect(queryByText(/Fullscreen did not start/i)).not.toBeNull()
  })

  it('takes that message back when fullscreen starts after all', async () => {
    vi.useFakeTimers()
    let answer: () => void = () => undefined
    const { getByLabelText, queryByText } = setup(
      () =>
        new Promise<void>((resolve) => {
          answer = resolve
        }),
    )
    await fireEvent.click(getByLabelText(/Toggle fullscreen/i))
    await vi.advanceTimersByTimeAsync(1100)
    expect(queryByText(/Fullscreen did not start/i)).not.toBeNull()
    answer()
    await vi.advanceTimersByTimeAsync(0)
    expect(queryByText(/Fullscreen did not start/i)).toBeNull()
  })

  it('keeps saying fullscreen is unavailable when the browser refuses, and says nothing else after', async () => {
    vi.useFakeTimers()
    const { getByLabelText, queryByText } = setup(() => Promise.reject(new Error('denied')))
    await fireEvent.click(getByLabelText(/Toggle fullscreen/i))
    await vi.advanceTimersByTimeAsync(0)
    expect(queryByText(/Fullscreen is unavailable/i)).not.toBeNull()
    await vi.advanceTimersByTimeAsync(2000)
    expect(queryByText(/Fullscreen did not start/i)).toBeNull()
    expect(queryByText(/Fullscreen is unavailable/i)).not.toBeNull()
  })

  it('says it is unavailable at once where the browser has no fullscreen request', async () => {
    const { getByLabelText, findByText } = setup(undefined)
    await fireEvent.click(getByLabelText(/Toggle fullscreen/i))
    expect(await findByText(/Fullscreen is unavailable/i)).toBeTruthy()
  })

  // The hosted Chromium run that followed failed the same gate on the same button. The gate allows 1.5 s for a visible
  // change, and the page's own answer (the grant, a refusal or the message above) can come later than that when the
  // runner is loaded. So the click itself changes the page: the button is busy until the browser has answered.
  describe('while the browser has not answered', () => {
    it('marks the button busy in the click itself, before any timer runs', async () => {
      vi.useFakeTimers()
      const { getByLabelText, getByTestId } = setup(() => new Promise(() => undefined))
      const seen = vi.fn()
      new MutationObserver(seen).observe(getByTestId('demo-runner-container'), {
        attributes: true,
        subtree: true,
        childList: true,
        characterData: true,
      })
      const button = getByLabelText(/Toggle fullscreen/i)
      expect(button.hasAttribute('aria-busy')).toBe(false)
      await fireEvent.click(button)
      await Promise.resolve()
      expect(button.getAttribute('aria-busy')).toBe('true')
      expect(seen).toHaveBeenCalled()
    })

    it('stops being busy when fullscreen starts', async () => {
      vi.useFakeTimers()
      let answer: () => void = () => undefined
      const { getByLabelText } = setup(
        () =>
          new Promise<void>((resolve) => {
            answer = resolve
          }),
      )
      const button = getByLabelText(/Toggle fullscreen/i)
      await fireEvent.click(button)
      expect(button.getAttribute('aria-busy')).toBe('true')
      answer()
      await vi.advanceTimersByTimeAsync(0)
      expect(button.hasAttribute('aria-busy')).toBe(false)
    })

    it('stops being busy when the browser refuses, and when it never answers', async () => {
      vi.useFakeTimers()
      const refused = setup(() => Promise.reject(new Error('denied')))
      const refusedButton = refused.getByLabelText(/Toggle fullscreen/i)
      await fireEvent.click(refusedButton)
      await vi.advanceTimersByTimeAsync(0)
      expect(refusedButton.hasAttribute('aria-busy')).toBe(false)
      refused.unmount()

      const silent = setup(() => new Promise(() => undefined))
      const silentButton = silent.getByLabelText(/Toggle fullscreen/i)
      await fireEvent.click(silentButton)
      expect(silentButton.getAttribute('aria-busy')).toBe('true')
      await vi.advanceTimersByTimeAsync(1100)
      expect(silentButton.hasAttribute('aria-busy')).toBe(false)
      expect(silent.queryByText(/Fullscreen did not start/i)).not.toBeNull()
    })
  })
})
