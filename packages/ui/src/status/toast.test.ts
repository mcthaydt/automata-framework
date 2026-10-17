import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Toast from './Toast.svelte'

let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

type Tone = 'info' | 'success' | 'warning' | 'error'

function open(props: { tone?: Tone; toneLabel?: string } = {}) {
  const target = document.createElement('div')
  document.body.append(target)
  component = mount(Toast, { target, props: { text: 'Pad connected', ...props } })
  flushSync()
  const toast = target.querySelector<HTMLElement>('[data-toast]')
  if (toast === null) throw new Error('no toast')
  return toast
}

function prefersReducedMotion(reduce: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
  }))
}

describe('Toast', () => {
  it('is a polite live region, and an error is an alert', () => {
    expect(open().getAttribute('role')).toBe('status')
    unmount(component as ReturnType<typeof mount>)
    component = undefined
    expect(open({ tone: 'error', toneLabel: 'Error' }).getAttribute('role')).toBe('alert')
  })

  it('never moves focus when it appears', () => {
    const button = document.createElement('button')
    document.body.append(button)
    button.focus()
    open({ tone: 'error', toneLabel: 'Error' })
    expect(document.activeElement).toBe(button)
  })

  // U-b: with every colour removed the tone still reads. The test reads text and attributes, never a colour.
  it('shows an error by a glyph and says its tone in words', () => {
    const toast = open({ tone: 'error', toneLabel: 'Error' })
    expect(toast.dataset.tone).toBe('error')
    const glyph = toast.querySelector('[data-toast-glyph]')
    expect(glyph?.textContent).toBe('✕')
    expect(glyph?.getAttribute('aria-hidden')).toBe('true')
    expect(toast.querySelector('.af-sr-only')?.textContent).toBe('Error')
    expect(toast.textContent).toContain('Pad connected')
  })

  it('throws while it mounts when a toned toast has no words', () => {
    expect(() => open({ tone: 'warning' })).toThrow(/Toast needs a toneLabel/)
  })

  it('slides in normally, and does not slide under reduced motion', () => {
    prefersReducedMotion(false)
    expect(open().dataset.motion).toBe('slide')
    unmount(component as ReturnType<typeof mount>)
    component = undefined
    prefersReducedMotion(true)
    expect(open().dataset.motion).toBe('none')
  })
})
