// @vitest-environment jsdom
import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Icon from '#src/shared/kit/icons/Icon.svelte'
import { ICON_NAMES, ICONS, type IconName } from '#src/shared/kit/icons/paths.ts'

/** The set the redesign draws with: tools, history, layers, document actions and states. */
const NAMES = [
  'select',
  'brush',
  'rectangle',
  'fill',
  'eraser',
  'eyedropper',
  'undo',
  'redo',
  'layers',
  'eye',
  'eye-off',
  'lock',
  'unlock',
  'more',
  'back',
  'plus',
  'trash',
  'share',
  'download',
  'copy',
  'play',
  'check',
  'alert',
  'chevron-down',
  'fit',
  'inspector',
  'close',
  'list',
  'home',
  'sliders',
  'grid',
  'review',
] as const satisfies readonly IconName[]

describe('Icon', () => {
  it('has exactly the 32 names of the set', () => {
    expect([...ICON_NAMES].sort()).toEqual([...NAMES].sort())
  })

  it.each(NAMES)('draws %s as a decorative 24 px stroke svg', (name) => {
    const { container } = render(Icon, { name })
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24')
    expect(svg).toHaveAttribute('stroke', 'currentColor')
    const shapes = [...(svg?.children ?? [])]
    expect(shapes.map((shape) => shape.tagName)).toEqual(ICONS[name].map(([tag]) => tag))
    for (const shape of shapes) expect(shape.namespaceURI).toBe('http://www.w3.org/2000/svg')
    const [, first] = ICONS[name][0] as (typeof ICONS)[typeof name][number]
    for (const [key, value] of Object.entries(first)) expect(shapes[0]).toHaveAttribute(key, value)
  })

  it('takes a size in px', () => {
    const { container } = render(Icon, { name: 'plus', size: 16 })
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '16')
    expect(svg).toHaveAttribute('height', '16')
  })

  it('is never focusable, so the button around it is the one stop', () => {
    const { container } = render(Icon, { name: 'plus' })
    expect(container.querySelector('svg')).toHaveAttribute('focusable', 'false')
  })
})

// An unknown name is a type error; svelte-check (typecheck) fails on it.
// @ts-expect-error 'sparkles' is not in the set
const unknown: IconName = 'sparkles'
void unknown
