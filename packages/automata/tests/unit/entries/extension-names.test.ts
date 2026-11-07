import { describe, expect, expectTypeOf, it } from 'vitest'
import type { ExtensionDef, UiComponent, UiSlotName } from '#src/entries/extension.ts'
import type { ErrorAction, SettingsTab } from '#src/entries/index.ts'
import { ErrorPanel, SettingsScreen } from '#src/entries/index.ts'

// An extension that fills a ui slot has to name the slot and the component it fills it with, and the UI kit
// built on the framework's error and settings screens has to import them: all of it from the public entries.
describe('the names extensions build on', () => {
  it('lets an extension name the type of its ui slots', () => {
    expectTypeOf<NonNullable<ExtensionDef['ui']>['slots']>().toEqualTypeOf<
      Readonly<Partial<Record<UiSlotName, UiComponent>>> | undefined
    >()
  })

  it('exports the error panel and the settings screen from the root', () => {
    expect(typeof ErrorPanel).toBe('function')
    expect(typeof SettingsScreen).toBe('function')
  })

  it('exports the types their props are made of', () => {
    expectTypeOf<ErrorAction>().toHaveProperty('label')
    expectTypeOf<SettingsTab>().toHaveProperty('sections')
  })
})
