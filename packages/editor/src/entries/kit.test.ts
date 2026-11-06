import { describe, expect, test } from 'vitest'
import * as kit from './kit'

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

  test('exports the widgets, the toast store and the move helper that honors locked rows', () => {
    for (const widget of [
      kit.Stepper,
      kit.Slider,
      kit.Segmented,
      kit.Chips,
      kit.Swatch,
      kit.ColorField,
      kit.Tabs,
      kit.Dialog,
      kit.ToastRegion,
      kit.StatusLine,
      kit.Menu,
      kit.Picker,
      kit.ReorderList,
      kit.Button,
      kit.Pill,
      kit.RecoveryDialog,
      kit.ConflictDialog,
    ]) {
      expect(widget).toBeTypeOf('function')
    }
    expect(kit.createToasts).toBeTypeOf('function')
    expect(kit.moveRow(['a', 'b', 'c'], (id) => id === 'b', 0, 2)).toEqual(['c', 'b', 'a'])
  })

  test('exports storage: the workspace, the stores, the document session and the page lifecycle', () => {
    for (const fn of [
      kit.openWorkspace,
      kit.createMemoryStore,
      kit.createDownloadStore,
      kit.createFolderStore,
      kit.createIndexedDbVault,
      kit.pickFolder,
      kit.restoreFolder,
      kit.createDocumentSession,
      kit.findRecovery,
      kit.discardRecovery,
      kit.flushOnHide,
      kit.classifyStorageError,
      kit.statPath,
      kit.readStored,
      kit.StorageError,
    ]) {
      expect(fn).toBeTypeOf('function')
    }
  })

  test('exports the project list a Home is built on', () => {
    expect(kit.HomeScreen).toBeTypeOf('function')
    expect(kit.FilePick).toBeTypeOf('function')
    expect(kit.createProjectBrowser).toBeTypeOf('function')
    expect(kit.filterEntries).toBeTypeOf('function')
    expect(kit.modifiedLabel).toBeTypeOf('function')
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
