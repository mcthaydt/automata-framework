import '@automata/framework/theme.css'
import {
  byTestId,
  mountFixture,
  publishConditions,
  REFERENCE_SIZES,
  settleLayout,
  VARIANTS,
} from '@automata/framework/testing'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import ErrorScreen from '#src/features/error/ErrorScreen.svelte'
import LoadingScreen from '#src/features/loading/LoadingScreen.svelte'
import ResultsScreen from '#src/features/results/ResultsScreen.svelte'
import TitleScreen from '#src/features/title/TitleScreen.svelte'

// The images the coordinator opens for a person to look at. They are written only
// when `VITE_REVIEW_IMAGES` names the folder, so a normal run changes nothing: `VITE_REVIEW_IMAGES=<absolute folder> pnpm test:browser`.
const OUT: string | undefined = import.meta.env.VITE_REVIEW_IMAGES
const SIZES = ['iphone-14', 'galaxy-chrome-landscape', 'desktop-720p']
const nothing = (): void => {}
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
      if (name === 'title') expect(byTestId('play')).toBeTruthy()
      await page.screenshot({ path: `${OUT}/${name}-${sizeName}.png` })
      await fixture.unmount()
    }
  }
})
