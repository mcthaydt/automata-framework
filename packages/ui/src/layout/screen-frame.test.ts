import { textSnippet } from '@mcthaydt/automata-testing'
import { render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import ScreenFrame from './ScreenFrame.svelte'

describe('ScreenFrame', () => {
  it('renders the corner row, hero, body and actions in that order, marked with its arrangement', () => {
    const { container } = render(ScreenFrame, {
      arrangement: 'stack',
      back: vi.fn(),
      backLabel: 'Back',
      hero: textSnippet('Hero'),
      body: textSnippet('Body'),
      actions: textSnippet('Actions'),
      testId: 'title-screen',
    })
    const frame = container.querySelector('[data-screen-frame]') as HTMLElement
    expect(frame.dataset.arrangement).toBe('stack')
    expect(frame.dataset.testid).toBe('title-screen')
    const text = frame.textContent ?? ''
    expect(text.indexOf('Back')).toBeLessThan(text.indexOf('Hero'))
    expect(text.indexOf('Hero')).toBeLessThan(text.indexOf('Body'))
    expect(text.indexOf('Body')).toBeLessThan(text.indexOf('Actions'))
    expect(frame.querySelector('[data-corner-controls]')).not.toBeNull()
  })

  it('leaves out the parts a screen does not have', () => {
    const { container } = render(ScreenFrame, { arrangement: 'split', body: textSnippet('Body') })
    const frame = container.querySelector('[data-screen-frame]') as HTMLElement
    expect(frame.dataset.arrangement).toBe('split')
    expect(frame.querySelector('.af-screen-frame__hero')).toBeNull()
    expect(frame.querySelector('.af-screen-frame__actions')).toBeNull()
    expect(frame.querySelector('button')).toBeNull()
  })
})
