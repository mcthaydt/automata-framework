import { fireEvent, render } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DemoRunner from '../src/lib/components/DemoRunner.svelte'
import ExamplesPage from '../src/routes/examples/+page.svelte'
import { examplesData } from './helpers/page-data'

describe('Examples Gallery', () => {
  it('renders category filter and active demo code', () => {
    const { getByText, getAllByText } = render(ExamplesPage, { props: { data: examplesData('renderer-2d') } })
    expect(getByText(/All Examples/i)).toBeTruthy()
    expect(getAllByText(/Renderer: 2D PixiJS/i).length).toBeGreaterThan(0)
  })

  it('DemoRunner renders container with controls and iframe element', () => {
    const { getByTestId, getByLabelText } = render(DemoRunner, {
      props: {
        src: '/demos/render-pixi/renderer-2d/index.html',
        title: 'Renderer: 2D PixiJS',
      },
    })
    expect(getByTestId('demo-runner-container')).toBeTruthy()
    expect(getByLabelText(/Restart demo/i)).toBeTruthy()
    expect(getByLabelText(/Toggle fullscreen/i)).toBeTruthy()
  })
})

// The browser gate that clicks every visible button (tests/e2e/gates.ts) found the fullscreen button doing nothing in
// headless WebKit once nothing else on the page was changing: the request is neither granted nor refused. A button
// that answers nothing looks dead, so the page says when the browser has not started fullscreen after a second.
describe('DemoRunner fullscreen button', () => {
  const props = { src: '/demos/render-pixi/renderer-2d/index.html', title: 'Renderer: 2D PixiJS' }
  const setup = (requestFullscreen: (() => Promise<void>) | undefined) => {
    const view = render(DemoRunner, { props })
    const container = view.getByTestId('demo-runner-container') as unknown as { requestFullscreen?: () => Promise<void> }
    container.requestFullscreen = requestFullscreen
    return view
  }

  afterEach(() => { vi.useRealTimers() })

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
    const { getByLabelText, queryByText } = setup(() => new Promise<void>(resolve => { answer = resolve }))
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
})
