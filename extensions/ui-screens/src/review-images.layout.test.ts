import '@automata/framework/theme.css'
import {
  byTestId,
  mountFixture,
  publishConditions,
  REFERENCE_SIZES,
  settleLayout,
  VARIANTS,
} from '@automata/framework/testing'
import { createRawSnippet } from 'svelte'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import ErrorScreen from './screens/ErrorScreen.svelte'
import LoadingScreen from './screens/LoadingScreen.svelte'
import PauseScreen from './screens/PauseScreen.svelte'
import ResultsScreen from './screens/ResultsScreen.svelte'
import SettingsScreen from './screens/SettingsScreen.svelte'
import TitleScreen from './screens/TitleScreen.svelte'

// The images the coordinator opens for visual acceptance (docs/evidence/owner-visual/product6-ui-screens-kit/). They are written only
// when `VITE_REVIEW_IMAGES` names the folder, so a normal run changes nothing: `VITE_REVIEW_IMAGES=<absolute folder> pnpm test:layout`.
const OUT: string | undefined = import.meta.env.VITE_REVIEW_IMAGES
const SIZES = ['iphone-14', 'galaxy-chrome-landscape', 'desktop-720p']
const nothing = (): void => {}
const section = (line: string, button: string) => ({
  snippet: createRawSnippet(() => ({
    render: () => `<div><p>${line}</p><button type="button" class="af-control">${button}</button></div>`,
  })),
})
const PAUSE = {
  title: 'Paused',
  resume: 'Resume',
  back: 'Back',
  mute: 'Mute',
  unmute: 'Unmute',
  settings: 'Settings',
  quit: 'Quit to title',
  quitPrompt: 'Quit?',
  quitConfirm: 'Quit',
  cancel: 'Cancel',
  reconnect: 'Reconnect your controller',
}
const SCREENS = {
  title: () =>
    mountFixture(TitleScreen, {
      title: 'Moss Garden',
      copy: { play: 'Play' },
      onPlay: nothing,
      extra: [
        { id: 'settings', label: 'Settings', shortLabel: 'Set' },
        { id: 'credits', label: 'Credits', shortLabel: 'Info' },
      ],
      onAction: nothing,
    }),
  pause: () =>
    mountFixture(PauseScreen, {
      copy: PAUSE,
      muted: false,
      onResume: nothing,
      onQuit: nothing,
      onSettings: nothing,
      onMute: nothing,
    }),
  settings: () =>
    mountFixture(SettingsScreen, {
      copy: { title: 'Settings', back: 'Back', tabs: 'Settings tabs', more: (n: number) => `+${n} more` },
      tabs: [
        {
          id: 'settings',
          label: 'Settings',
          sections: [section('Volume', 'Louder'), section('Brightness', 'Brighter')],
        },
        { id: 'controls', label: 'Controls', sections: [section('Rebind keys', 'Rebind')] },
      ],
      onBack: nothing,
    }),
  results: () =>
    mountFixture(ResultsScreen, {
      title: 'Race over',
      rows: ['Wren', 'Ash', 'Moss', 'Fern', 'Birch', 'Sedge'].map((name, i) => ({
        id: `p${i}`,
        label: name,
        value: `${38 + i} s`,
        ...(i === 0 ? { detail: 'new best' } : {}),
      })),
      highlight: 'p1',
      actions: [
        { id: 'again', label: 'Play again', primary: true },
        { id: 'title', label: 'Back to title', shortLabel: 'Title' },
      ],
      copy: { rows: 'Results', empty: 'Nothing to show', more: (n: number) => `+${n} more` },
      onAction: nothing,
    }),
  loading: () =>
    mountFixture(LoadingScreen, {
      title: 'Moss Garden',
      label: 'Loading',
      slowLabel: 'Still loading…',
      progress: 0.4,
    }),
  error: () =>
    mountFixture(ErrorScreen, {
      code: 'save-failed',
      message: 'The save could not be written to this device. Free some space and try again.',
      actions: [
        { id: 'retry', label: 'Try again', kind: 'primary' as const, onSelect: nothing },
        { id: 'skip', label: 'Continue without saving', kind: 'secondary' as const, onSelect: nothing },
      ],
      onBack: nothing,
      backLabel: 'Back',
    }),
} as const

test.skipIf(OUT === undefined)('writes the review images', async () => {
  for (const sizeName of SIZES) {
    const size = REFERENCE_SIZES.find((s) => s.name === sizeName)
    const rest = VARIANTS.find((v) => v.name === 'rest')
    if (size === undefined || rest === undefined) throw new Error(`no ${sizeName} or rest`)
    await page.viewport(size.width, size.height)
    for (const [name, show] of Object.entries(SCREENS)) {
      publishConditions(document.documentElement, size, rest)
      const fixture = show()
      await settleLayout()
      if (name === 'pause') expect(byTestId('resume')).toBeTruthy()
      await page.screenshot({ path: `${OUT}/${name}-${sizeName}.png` })
      await fixture.unmount()
    }
  }
})
