import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ControlsTouchMode } from '#src/app/screens/settings/controls-section.ts'
import TouchSection from '#src/app/screens/settings/TouchSection.svelte'
import type { TouchCopy } from '#src/app/screens/settings/touch-section.ts'

// The Touch controls group of the Settings tab (Owner, 2026-10-18): how
// touch drives play, buttons or swipes, as an option group. The game shows it on a coarse pointer when it offers both.

const copy: TouchCopy = {
  title: 'Touch controls',
  mode: 'Steer with',
  modes: { buttons: 'Buttons', swipe: 'Swipe' },
}

let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
})

describe('TouchSection', () => {
  it('is a group named Touch controls offering the game’s modes, the chosen one checked, and reports a choice', () => {
    const onchange = vi.fn()
    const host = document.createElement('div')
    document.body.append(host)
    const modes: ControlsTouchMode[] = ['buttons', 'swipe']
    component = mount(TouchSection, { target: host, props: { copy, modes, value: 'buttons', onchange } })
    flushSync()
    const section = host.querySelector<HTMLElement>('[data-settings-section="touch"]') as HTMLElement
    expect(section.querySelector('h3')?.textContent).toBe('Touch controls')
    const radios = [...section.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
    expect(radios.map((radio) => [radio.value, radio.checked])).toEqual([
      ['buttons', true],
      ['swipe', false],
    ])
    radios[1]?.click()
    expect(onchange).toHaveBeenCalledWith('swipe')
  })
})
