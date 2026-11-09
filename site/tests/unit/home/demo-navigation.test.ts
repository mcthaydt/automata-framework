import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'

vi.mock('$app/environment', () => ({ browser: true }))

import DemoRunner from '../../../src/features/home/DemoRunner.svelte'
import { demoStatus } from '../../../src/features/home/demo-status'

// The gallery's ?demo= and ?file= selection is retired with the gallery (WEB.PLAY.5): /examples is one prerendered
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
    const view = render(DemoRunner, { props: { src: '/demos/emberwick/index.html', title: 'Starter' } })
    expect(view.container.querySelector('iframe')).toBeTruthy()
    await fireEvent.click(view.getByRole('button', { name: 'Stop' }))
    expect(view.container.querySelector('iframe')).toBeNull()
    await fireEvent.click(view.getAllByRole('button', { name: 'Play demo' })[0])
    expect(view.container.querySelector('iframe')?.getAttribute('src')).toBe('/demos/emberwick/index.html')
  })
})
