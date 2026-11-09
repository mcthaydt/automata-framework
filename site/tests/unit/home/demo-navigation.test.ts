import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'

vi.mock('$app/environment', () => ({ browser: true }))

import DemoRunner from '#src/features/home/DemoRunner.svelte'
import { demoStatus } from '#src/features/home/demo-status.ts'
import { DEMO_BAR } from '#src/features/home/home-content.ts'

// The gallery's ?demo= and ?file= selection is retired with the gallery: /examples is one prerendered
// index whatever the query (tests/examples-pages.test.ts).
describe('Demo readiness', () => {
  it('does not equate document load with game readiness', () => {
    const doc = document.implementation.createHTMLDocument('404')
    expect(demoStatus(doc)).toBe('loading')
    doc.documentElement.dataset.state = 'ready'
    expect(demoStatus(doc)).toBe('ready')
    doc.documentElement.dataset.state = 'failed'
    expect(demoStatus(doc)).toBe('failed')
    delete doc.documentElement.dataset.state
    doc.documentElement.setAttribute('data-ready', '')
    expect(demoStatus(doc)).toBe('ready')
  })
  it('recognizes a mounted UI gallery, without declaring an empty page ready', () => {
    const doc = document.implementation.createHTMLDocument('UI example')
    expect(demoStatus(doc)).toBe('loading')
    doc.body.innerHTML =
      '<main class="gallery"><select name="show"><option>screen</option></select><iframe title="screen at 360 by 640"></iframe></main>'
    expect(demoStatus(doc)).toBe('ready')
  })
  it('unloads the iframe when stopped and restarts a fresh session', async () => {
    const view = render(DemoRunner, {
      props: {
        src: '/demos/emberwick/index.html',
        poster: '/previews/emberwick.jpg',
        posterAlt: 'x',
        bar: DEMO_BAR,
      },
    })
    await fireEvent.click(view.getByRole('button', { name: 'Play it' }))
    expect(view.container.querySelector('iframe')).toBeTruthy()
    await fireEvent.click(view.getByRole('button', { name: 'Stop' }))
    expect(view.container.querySelector('iframe')).toBeNull()
    await fireEvent.click(view.getByRole('button', { name: 'Play it' }))
    expect(view.container.querySelector('iframe')?.getAttribute('src')).toBe('/demos/emberwick/index.html')
  })
  it('opens the game in the screen it is told to, because the visitor already pressed Play it', async () => {
    const view = render(DemoRunner, {
      props: {
        src: '/demos/emberwick/index.html',
        start: 'room',
        poster: '/previews/emberwick.jpg',
        posterAlt: 'x',
        bar: DEMO_BAR,
      },
    })
    await fireEvent.click(view.getByRole('button', { name: 'Play it' }))
    expect(view.container.querySelector('iframe')?.getAttribute('src')).toBe(
      '/demos/emberwick/index.html?start=room',
    )
  })

  it('says "Exit full screen" while the demo is in full screen, and "Full screen" otherwise', async () => {
    const view = render(DemoRunner, {
      props: {
        src: '/demos/emberwick/index.html',
        poster: '/previews/emberwick.jpg',
        posterAlt: 'x',
        bar: DEMO_BAR,
      },
    })
    await fireEvent.click(view.getByRole('button', { name: 'Play it' }))
    expect(view.getByRole('button', { name: 'Full screen' })).toBeTruthy()
    const container = view.getByTestId('demo-runner-container')
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => container })
    document.dispatchEvent(new Event('fullscreenchange'))
    expect(await view.findByRole('button', { name: 'Exit full screen' })).toBeTruthy()
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => null })
    document.dispatchEvent(new Event('fullscreenchange'))
    expect(await view.findByRole('button', { name: 'Full screen' })).toBeTruthy()
  })
})
