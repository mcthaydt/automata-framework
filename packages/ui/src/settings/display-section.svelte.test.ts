import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DisplaySection from './DisplaySection.svelte'
import type { DisplayCopy, DisplayQuality } from './display-section'

// The Display section (M4 spec §4.8, §7): the graphics quality as an option group, and reduced motion as the browser
// reports it, shown and never changed here.

const copy: DisplayCopy = {
  title: 'Display',
  quality: 'Graphics quality',
  qualities: { high: 'High', medium: 'Medium', low: 'Low' },
  reducedMotion: (reduced) => `Reduced motion: ${reduced ? 'on' : 'off'} (from your device)`,
}

let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
})

function open(reducedMotion = false) {
  const onquality = vi.fn()
  const props = $state({ copy, quality: 'high' as DisplayQuality, onquality, reducedMotion })
  const host = document.createElement('div')
  document.body.append(host)
  component = mount(DisplaySection, { target: host, props })
  flushSync()
  const section = host.querySelector<HTMLElement>('[data-settings-section="display"]') as HTMLElement
  return { props, section, onquality }
}

describe('DisplaySection', () => {
  it('offers the three quality tiers, the chosen one checked, and reports a choice', () => {
    const { section, onquality } = open()
    const radios = [...section.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
    expect(radios.map((radio) => radio.value)).toEqual(['high', 'medium', 'low'])
    expect(radios.find((radio) => radio.checked)?.value).toBe('high')
    radios[2]?.click()
    expect(onquality).toHaveBeenCalledWith('low')
    expect(section.querySelector('h3')?.textContent).toBe('Display')
  })

  it('shows reduced motion as the browser reports it, with nothing to change', () => {
    const { section } = open(true)
    const motion = section.querySelector<HTMLElement>('[data-display-motion]')
    expect(motion?.textContent).toBe('Reduced motion: on (from your device)')
    expect(motion?.querySelector('input, button')).toBeNull()
  })
})
