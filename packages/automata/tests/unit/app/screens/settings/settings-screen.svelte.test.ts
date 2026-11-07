import { createRawSnippet, flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SettingsScreen from '#src/app/screens/settings/SettingsScreen.svelte'
import Extension from '../../../../fixtures/app/screens/settings/SettingsExtension.test.svelte'

// The core Settings screen (M4 spec §4.8, M4-D8), laid out and behaving as FloorFifty's settings
// (`ui/components/SettingsPanel.svelte` and `PauseOverlay.svelte` at a28dc44; Owner 2026-10-18, "match the layout and
// function, not the style"): a dialog over the dimmed game, two tabs whose sections scroll under them in one list,
// and Back under the dialog; Escape and the dialog's Close go back too.

let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
})

const section = (name: string) =>
  createRawSnippet(() => ({
    render: () => `<section data-settings-section="${name}"><h3>${name}</h3></section>`,
  }))

function open() {
  const onback = vi.fn()
  const host = document.createElement('div')
  document.body.append(host)
  component = mount(SettingsScreen, {
    target: host,
    props: {
      title: 'Settings',
      backLabel: 'Back',
      onback,
      tabsLabel: 'Settings sections',
      tabs: [
        {
          id: 'settings',
          label: 'Settings',
          sections: [{ snippet: section('display') }, { component: Extension }],
        },
        { id: 'controls', label: 'Controls', sections: [{ snippet: section('controls') }] },
      ],
      moreLabel: (count: number) => `+${count} more`,
    },
  })
  flushSync()
  return { host, onback }
}

const shown = (host: HTMLElement, label: string) => {
  const list = host.querySelector<HTMLElement>(`[data-scroll-region][aria-label="${label}"]`)
  return list === null
    ? null
    : [...list.querySelectorAll<HTMLElement>('[data-row] [data-settings-section]')].map(
        (one) => one.dataset.settingsSection,
      )
}

describe('SettingsScreen', () => {
  it('is a dialog over the dimmed game, titled Settings', () => {
    const { host } = open()
    const dialog = host.querySelector<HTMLElement>('[data-testid="settings-screen"]')
    expect(dialog?.getAttribute('role')).toBe('dialog')
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    expect(dialog?.closest('[data-modal-scrim]')).not.toBeNull()
    expect(dialog?.querySelector('h2')?.textContent).toBe('Settings')
  })

  it('has two tabs, Settings first; each tab’s sections are the rows of one scroll list', () => {
    const { host } = open()
    const tabs = [...host.querySelectorAll<HTMLButtonElement>('[role="tablist"] [role="tab"]')]
    expect(tabs.map((tab) => [tab.textContent?.trim(), tab.getAttribute('aria-selected')])).toEqual([
      ['Settings', 'true'],
      ['Controls', 'false'],
    ])
    expect(shown(host, 'Settings')).toEqual(['display', 'extension'])
    tabs[1]?.click()
    flushSync()
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true')
    expect(shown(host, 'Settings')).toBeNull()
    expect(shown(host, 'Controls')).toEqual(['controls'])
  })

  it('goes back from Back under the dialog, from its Close and from Escape', () => {
    const { host, onback } = open()
    host.querySelector<HTMLButtonElement>('[data-testid="settings-back"]')?.click()
    host.querySelector<HTMLButtonElement>('[data-modal-close]')?.click()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
    expect(onback).toHaveBeenCalledTimes(3)
  })
})
