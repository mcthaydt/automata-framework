import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import VibrationSection from './VibrationSection.svelte'
import type { VibrationCopy } from './vibration-section'

// The Vibration group of the Settings tab (Owner, 2026-10-18; FloorFifty's rumble row in `SettingsPanel.svelte` at
// a28dc44): one toggle for a pad's rumble and a phone's buzz. The game shows it only where the device can do either.

const copy: VibrationCopy = { title: 'Vibration', toggle: 'Rumble and vibration', on: 'On', off: 'Off' }

let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
})

describe('VibrationSection', () => {
  it('is a group named Vibration with one toggle, showing the setting and reporting a change', () => {
    const onchange = vi.fn()
    const host = document.createElement('div')
    document.body.append(host)
    component = mount(VibrationSection, { target: host, props: { copy, enabled: true, onchange } })
    flushSync()
    const section = host.querySelector<HTMLElement>('[data-settings-section="vibration"]') as HTMLElement
    expect(section.querySelector('h3')?.textContent).toBe('Vibration')
    const toggle = section.querySelector<HTMLInputElement>(
      '[data-testid="vibration-enabled"] input',
    ) as HTMLInputElement
    expect(toggle.checked).toBe(true)
    toggle.click()
    expect(onchange).toHaveBeenCalledWith(false)
  })
})
