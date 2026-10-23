import { describe, expect, test } from 'vitest'
import * as kit from './index'

describe('editor-kit entry', () => {
  test('exports the shell, its rules and the token renderer', () => {
    expect(kit.EditorShell).toBeTypeOf('function')
    expect(kit.shellModeOf).toBeTypeOf('function')
    expect(kit.reconcileOpen).toBeTypeOf('function')
    expect(kit.tokensToCss).toBeTypeOf('function')
  })

  test('exports history, selection, commands and the keymap', () => {
    expect(kit.createHistory).toBeTypeOf('function')
    expect(kit.HistoryError).toBeTypeOf('function')
    expect(kit.createSelection).toBeTypeOf('function')
    expect(kit.defineCommand).toBeTypeOf('function')
    expect(kit.createCommandRegistry).toBeTypeOf('function')
    expect(kit.createKeymap).toBeTypeOf('function')
    expect(kit.parseShortcut).toBeTypeOf('function')
  })

  test('exports the typed field and entity definition rules and schemas', () => {
    const rules = [
      kit.checkFieldValue,
      kit.checkFieldDef,
      kit.checkEntityDef,
      kit.defaultFieldValue,
      kit.checkValues,
      kit.valuesWithDefaults,
      kit.renameFieldValues,
      kit.checkRetype,
      kit.renameField,
    ]
    for (const rule of rules) expect(rule).toBeTypeOf('function')
    const schemas = [kit.fieldValueSchema, kit.fieldValuesSchema, kit.fieldDefSchema, kit.entityDefSchema]
    for (const schema of schemas) expect(schema.safeParse).toBeTypeOf('function')
    expect(kit.FIELD_TYPES).toHaveLength(9)
  })
})
