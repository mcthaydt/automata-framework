import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import Chip from '#src/status/Chip.svelte'

let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
})

function open(props: { tone?: 'info' | 'success' | 'warning' | 'danger'; toneLabel?: string }) {
  const target = document.createElement('div')
  document.body.append(target)
  component = mount(Chip, { target, props: { text: 'Saved', ...props } })
  flushSync()
  const chip = target.querySelector<HTMLElement>('[data-chip]')
  if (chip === null) throw new Error('no chip')
  return chip
}

describe('Chip', () => {
  it.each(['info', 'success', 'warning', 'danger'] as const)('its %s tone is data-tone', (tone) => {
    expect(open({ tone, toneLabel: 'Note' }).dataset.tone).toBe(tone)
  })

  it('is info by default, with no glyph and only its text', () => {
    const chip = open({})
    expect(chip.dataset.tone).toBe('info')
    expect(chip.querySelector('[data-chip-glyph]')).toBeNull()
    expect(chip.textContent?.trim()).toBe('Saved')
  })

  // §4.12: with every colour removed, the tone still reads, from a glyph a sighted player sees and words a screen
  // reader says. The test reads text and attributes only, never a computed colour.
  it.each([
    ['success', '✓'],
    ['warning', '!'],
    ['danger', '✕'],
  ] as const)('a %s chip shows a hidden glyph and says its tone in words', (tone, glyph) => {
    const chip = open({ tone, toneLabel: 'Problem' })
    const mark = chip.querySelector('[data-chip-glyph]')
    expect(mark?.textContent).toBe(glyph)
    expect(mark?.getAttribute('aria-hidden')).toBe('true')
    expect(chip.querySelector('.af-sr-only')?.textContent).toBe('Problem')
    expect(chip.textContent).toContain('Saved')
  })

  it('throws while it mounts when a non-info tone has no words, so the tone is never colour alone', () => {
    expect(() => open({ tone: 'danger' })).toThrow(/Chip needs a toneLabel/)
  })
})
