import { createRawSnippet, flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Button from './Button.svelte'
import IconButton from './IconButton.svelte'

let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
})

const text = (words: string) => createRawSnippet(() => ({ render: () => `<span>${words}</span>` }))
const glyph = createRawSnippet(() => ({ render: () => '<svg viewBox="0 0 1 1"></svg>' }))

function host(): HTMLElement {
  const target = document.createElement('div')
  document.body.append(target)
  return target
}

describe('Button', () => {
  it.each([
    ['primary', 'af-control--primary'],
    ['secondary', undefined],
    ['ghost', 'af-control--ghost'],
  ] as const)('a %s button is an .af-control of that kind', (kind, modifier) => {
    const target = host()
    component = mount(Button, { target, props: { kind, children: text('Play') } })
    flushSync()
    const button = target.querySelector('button')
    expect(button?.classList.contains('af-control')).toBe(true)
    expect(button?.type).toBe('button')
    expect(button?.dataset.kind).toBe(kind)
    if (modifier !== undefined) expect(button?.classList.contains(modifier)).toBe(true)
    expect(button?.textContent).toBe('Play')
  })

  it('is secondary by default, reports a click, and `disabled` disables it', () => {
    const onclick = vi.fn()
    const target = host()
    component = mount(Button, { target, props: { onclick, disabled: true, children: text('Play') } })
    flushSync()
    const button = target.querySelector('button')
    expect(button?.dataset.kind).toBe('secondary')
    expect(button?.disabled).toBe(true)
    button?.click()
    expect(onclick).not.toHaveBeenCalled()
  })

  it('reports a click while enabled', () => {
    const onclick = vi.fn()
    const target = host()
    component = mount(Button, { target, props: { onclick, children: text('Play') } })
    flushSync()
    target.querySelector('button')?.click()
    expect(onclick).toHaveBeenCalledOnce()
  })
})

describe('IconButton', () => {
  it('is named by its label, and its icon is hidden from assistive technology', () => {
    const target = host()
    component = mount(IconButton, { target, props: { label: 'Settings', icon: glyph } })
    flushSync()
    const button = target.querySelector('button')
    expect(button?.getAttribute('aria-label')).toBe('Settings')
    expect(button?.classList.contains('af-control')).toBe(true)
    const icon = button?.querySelector('[aria-hidden="true"]')
    expect(icon?.querySelector('svg')).not.toBeNull()
  })

  it('throws while it mounts when its label is empty, so a nameless one cannot ship', () => {
    const target = host()
    expect(() => {
      component = mount(IconButton, { target, props: { label: '  ', icon: glyph } })
      flushSync()
    }).toThrow(/IconButton needs a label/)
  })
})
