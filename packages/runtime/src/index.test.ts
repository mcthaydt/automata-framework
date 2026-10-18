import { expect, test } from 'vitest'

// The public surface (M1.5 spec §3.1): one expected export list per entry point.
// Each later task adds its names here when it adds the export.
const ROOT_EXPORTS: string[] = [
  'AUDIO_BUS_NAMES',
  'AppLoop',
  'AssetLoadFailed',
  'Assets',
  'AudioBuses',
  'BootDefect',
  'ContentHashMismatch',
  'DEFAULT_QUALITY',
  'Flow',
  'GESTURE_TUNING',
  'Input',
  'LOCALE_SAVE_KEY',
  'LoadStalled',
  'Locale',
  'MAX_FRAME_MS',
  'NetworkPort',
  'PresentationBus',
  'QUALITY_TIERS',
  'RESERVED_KEYS',
  'RESERVED_PAD_BUTTONS',
  'Renderer',
  'RendererUnavailable',
  'SLOW_MS',
  'STALL_MS',
  'STANDARD_PAD_BUTTON_MAX',
  'SaveFromNewerBuild',
  'SaveRefused',
  'SaveUnreadable',
  'Settings',
  'SwipeTracker',
  'Time',
  'actionsForGesture',
  'actionsForKey',
  'actionsForPadButton',
  'applyDocumentLocale',
  'audioBusGainsSchema',
  'createT',
  'defineSave',
  'displaySettingsSchema',
  'formatDuration',
  'formatNumber',
  'formatPercent',
  'inputProfileSchema',
  'makeInput',
  'matchLocale',
  'negotiateLocale',
  'pluralCategory',
  'qualityTierSchema',
  'runGame',
  'saveService',
  'selectPlural',
  'settingsStore',
  'textDirection',
  'touchModesFor',
  'typedBus',
]
const EXTENSION_EXPORTS: string[] = ['ExtensionError', 'defineExtension', 'resolveExtensions']
const TESTING_EXPORTS: string[] = ['RuntimeTest', 'fakeFetch', 'manualFrames', 'nullRenderer']

// 90 s budget: importing the whole entry took 28.5 s on the shared af-linux runner (2026-10-16, run
// 38862520260), past the old 15 s. The root test:unit default is the same 90 s; packages/ship's workflows test pins both.
test('the root entry exports exactly the expected names', async () => {
  const entry = await import('./index')
  expect(Object.keys(entry).sort()).toEqual(ROOT_EXPORTS)
}, 90_000)

test('the ./extension entry exports exactly the expected names', async () => {
  const entry = await import('./extension/index')
  expect(Object.keys(entry).sort()).toEqual(EXTENSION_EXPORTS)
})

test('the ./testing entry exports exactly the expected names', async () => {
  const entry = await import('./testing/index')
  expect(Object.keys(entry).sort()).toEqual(TESTING_EXPORTS)
})
