import { createRawSnippet, flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SettingsScreen from './SettingsScreen.svelte'

// The core Settings screen (M4 spec §4.8, M4-D8): the sections in a scroll list that keeps them reachable, the
// screen's title, and Back in the corner row.

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
      sections: [section('controls'), section('display'), section('extension')],
      listLabel: 'Settings sections',
      moreLabel: (count: number) => `+${count} more`,
    },
  })
  flushSync()
  return { host, onback }
}

describe('SettingsScreen', () => {
  it('shows its title and each section, in order, as rows of one scroll list', () => {
    const { host } = open()
    expect(host.querySelector('[data-testid="settings-screen"] h2')?.textContent).toBe('Settings')
    const list = host.querySelector<HTMLElement>('[data-scroll-region][aria-label="Settings sections"]')
    expect(list).not.toBeNull()
    const sections = [
      ...(list as HTMLElement).querySelectorAll<HTMLElement>('[data-row] [data-settings-section]'),
    ]
    expect(sections.map((one) => one.dataset.settingsSection)).toEqual(['controls', 'display', 'extension'])
  })

  it('goes back from the corner control', () => {
    const { host, onback } = open()
    host.querySelector<HTMLButtonElement>('[data-testid="corner-back"]')?.click()
    expect(onback).toHaveBeenCalledOnce()
  })
})
