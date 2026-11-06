import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AudioSection from '#src/app/screens/settings/AudioSection.svelte'
import type { AudioCopy, AudioValue } from '#src/app/screens/settings/audio-section.ts'

// The Audio group of the Settings tab (M5 spec §7, M5.4), in order: Mute, Mute in the background, then a slider per bus with its percentage. A change applies at once; when
// audio could not start the group says so and its controls are disabled; a note says the host's volume also applies.

const copy: AudioCopy = {
  title: 'Audio',
  mute: 'Mute',
  muteUnfocused: 'Mute in the background',
  on: 'On',
  off: 'Off',
  buses: { master: 'Master', music: 'Music', sfx: 'Effects', ui: 'Menus', voice: 'Voices' },
  percent: (value) => `${Math.round(value * 100)}%`,
  unavailable: 'Sound could not start on this device.',
  hostVolume: 'The host’s volume also applies.',
}
const VALUE: AudioValue = {
  muted: false,
  muteUnfocused: true,
  gains: { master: 1, music: 0.5, sfx: 0.25, ui: 1, voice: 0 },
}

let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
})

function open(overrides: { available?: boolean; hostBelowFull?: boolean } = {}) {
  const onchange = vi.fn()
  const onsample = vi.fn()
  const props = $state({
    copy,
    value: VALUE,
    available: true,
    hostBelowFull: false,
    onchange,
    onsample,
    ...overrides,
  })
  const host = document.createElement('div')
  document.body.append(host)
  component = mount(AudioSection, { target: host, props })
  flushSync()
  const section = host.querySelector<HTMLElement>('[data-settings-section="audio"]') as HTMLElement
  return { props, section, onchange, onsample }
}

describe('AudioSection', () => {
  it('is a group named Audio: the two toggles, then a slider per bus with its percentage, in that order', () => {
    const { section } = open()
    expect(section.querySelector('h3')?.textContent).toBe('Audio')
    const toggles = [...section.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
    expect(
      toggles.map((toggle) => [toggle.closest('[data-testid]')?.getAttribute('data-testid'), toggle.checked]),
    ).toEqual([
      ['audio-muted', false],
      ['audio-mute-unfocused', true],
    ])
    const sliders = [...section.querySelectorAll<HTMLElement>('[data-audio-bus]')]
    expect(
      sliders.map((slider) => [slider.dataset.audioBus, slider.textContent?.replace(/\s+/g, ' ').trim()]),
    ).toEqual([
      ['master', 'Master 100%'],
      ['music', 'Music 50%'],
      ['sfx', 'Effects 25%'],
      ['ui', 'Menus 100%'],
      ['voice', 'Voices 0%'],
    ])
  })

  it('reports each change by its field: a toggle, or a bus and its gain', () => {
    const { section, onchange } = open()
    section.querySelector<HTMLInputElement>('[data-testid="audio-muted"] input')?.click()
    expect(onchange).toHaveBeenLastCalledWith({ kind: 'muted', value: true })
    section.querySelector<HTMLInputElement>('[data-testid="audio-mute-unfocused"] input')?.click()
    expect(onchange).toHaveBeenLastCalledWith({ kind: 'muteUnfocused', value: false })
    const music = section.querySelector<HTMLInputElement>(
      '[data-audio-bus="music"] input',
    ) as HTMLInputElement
    music.value = '0.75'
    music.dispatchEvent(new Event('input', { bubbles: true }))
    music.dispatchEvent(new Event('change', { bubbles: true }))
    expect(onchange).toHaveBeenLastCalledWith({ kind: 'gain', bus: 'music', value: 0.75 })
  })

  it('says when sound could not start, and keeps its controls shown but disabled (A-e)', () => {
    const { section } = open({ available: false })
    expect(section.querySelector('[data-audio-unavailable]')?.textContent).toBe(
      'Sound could not start on this device.',
    )
    const inputs = [...section.querySelectorAll<HTMLInputElement>('input')]
    expect(inputs.length).toBe(7)
    expect(inputs.every((input) => input.disabled)).toBe(true)
  })

  it('notes the host’s volume only while it is below full', () => {
    const { section, props } = open()
    expect(section.querySelector('[data-audio-host-volume]')).toBeNull()
    props.hostBelowFull = true
    flushSync()
    expect(section.querySelector('[data-audio-host-volume]')?.textContent).toBe(
      'The host’s volume also applies.',
    )
  })

  // A sample plays when a volume is let go, so the player hears the level they set (redo step 11).
  it('asks for a sample on the bus when its slider is let go, and not while it moves', () => {
    const { section, onsample } = open()
    const voice = section.querySelector<HTMLInputElement>(
      '[data-audio-bus="voice"] input',
    ) as HTMLInputElement
    voice.value = '0.5'
    voice.dispatchEvent(new Event('input', { bubbles: true }))
    expect(onsample).not.toHaveBeenCalled()
    voice.dispatchEvent(new Event('change', { bubbles: true }))
    expect(onsample).toHaveBeenCalledWith('voice')
  })
})
