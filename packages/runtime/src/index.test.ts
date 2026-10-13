import { expect, test } from 'vitest'

// The public surface (M1.5 spec §3.1): one expected export list per entry point.
// Each later task adds its names here when it adds the export.
const ROOT_EXPORTS: string[] = ['PresentationBus', 'typedBus']
const EXTENSION_EXPORTS: string[] = ['ExtensionError', 'defineExtension', 'resolveExtensions']
const TESTING_EXPORTS: string[] = []

test('the root entry exports exactly the expected names', async () => {
  const entry = await import('./index')
  expect(Object.keys(entry).sort()).toEqual(ROOT_EXPORTS)
})

test('the ./extension entry exports exactly the expected names', async () => {
  const entry = await import('./extension/index')
  expect(Object.keys(entry).sort()).toEqual(EXTENSION_EXPORTS)
})

test('the ./testing entry exports exactly the expected names', async () => {
  const entry = await import('./testing/index')
  expect(Object.keys(entry).sort()).toEqual(TESTING_EXPORTS)
})
