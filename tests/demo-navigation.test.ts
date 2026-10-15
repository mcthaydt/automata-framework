import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
vi.mock('$app/environment', () => ({ browser: true }))
import { load } from '../src/routes/examples/+page'
import { demoStatus } from '../src/lib/utils/demo-status'
import { isEditing } from '../src/lib/utils/keyboard'
import DemoRunner from '../src/lib/components/DemoRunner.svelte'

describe('Demo URLs and readiness', () => {
  it('selects the requested demo and falls back for unknown slugs', async () => {
    const selected = await load({ url: new URL('https://example.test/examples?demo=base-2d') } as any)
    expect(selected).toEqual({ demo: 'base-2d' })
    const unknown = await load({ url: new URL('https://example.test/examples?demo=missing') } as any)
    expect(unknown).toEqual({ demo: 'renderer-2d' })
  })
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
  it('unloads the iframe when stopped and restarts a fresh session', async () => {
    const view = render(DemoRunner, { props: { src: '/demos/base-2d/index.html', title: 'Starter' } })
    expect(view.container.querySelector('iframe')).toBeTruthy()
    await fireEvent.click(view.getByRole('button', { name: 'Stop demo' }))
    expect(view.container.querySelector('iframe')).toBeNull()
    await fireEvent.click(view.getAllByRole('button', { name: 'Play demo' })[0])
    expect(view.container.querySelector('iframe')?.getAttribute('src')).toBe('/demos/base-2d/index.html')
  })
  it('identifies editable targets so slash does not steal their input', () => {
    const input = document.createElement('input')
    const event = new KeyboardEvent('keydown', { key: '/' })
    Object.defineProperty(event, 'target', { value: input })
    expect(isEditing(event)).toBe(true)
  })
})
