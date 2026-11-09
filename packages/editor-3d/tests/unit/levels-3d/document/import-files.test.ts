// Importing a folder or a zip into the workspace (ED3D.5b step 6; ED3D spec §8, open question 1): on an iPad a game's
// level files reach the OPFS workspace this way. Everything lands under one root folder and nothing is overwritten.
import { type ProjectStore, StorageError } from '@automata/editor/kit/core'
import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { createEditorApp } from '#src/features/levels-3d/document/editor-app.ts'
import {
  importFolder,
  importZip,
  MAX_ZIP_BYTES,
  MAX_ZIP_ENTRIES,
} from '#src/features/levels-3d/document/import-files.ts'
import { MAX_FILE_BYTES } from '#src/features/levels-3d/document/read-level.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'
import { createTestClock, memoryWorkspace, textOf } from '#src/testing/memory-workspace.ts'

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text)
const storeOf = () => memoryWorkspace(createTestClock()).store
const paths = async (store: ProjectStore): Promise<string[]> =>
  (await store.list()).map((entry) => entry.path)

describe('importFolder', () => {
  it('writes the folder’s files under its name, and a second import of it under `name 2`', async () => {
    const store = storeOf()
    const files = [
      { path: 'levels/clinic/blockout.json', bytes: bytes('{"a": 1}') },
      { path: 'levels/notes.txt', bytes: bytes('hi') },
    ]
    expect(await importFolder(store, files)).toEqual({
      status: 'imported',
      root: 'levels',
      files: ['levels/clinic/blockout.json', 'levels/notes.txt'],
      skipped: [],
    })
    expect(textOf(await store.read('levels/clinic/blockout.json'))).toBe('{"a": 1}')
    expect(await importFolder(store, files)).toMatchObject({
      status: 'imported',
      root: 'levels 2',
      files: ['levels 2/clinic/blockout.json', 'levels 2/notes.txt'],
    })
    expect(textOf(await store.read('levels/notes.txt'))).toBe('hi')
  })

  it('skips system files, unsafe paths and files over 16 MB, and says why', async () => {
    const store = storeOf()
    const outcome = await importFolder(store, [
      { path: 'pack/a.json', bytes: bytes('{}') },
      { path: 'pack/.DS_Store', bytes: bytes('x') },
      { path: 'pack/__MACOSX/a.json', bytes: bytes('x') },
      { path: 'pack/../escape.json', bytes: bytes('x') },
      { path: 'pack/a\\b.json', bytes: bytes('x') },
      { path: 'pack//c.json', bytes: bytes('x') },
      { path: 'pack/big.bin', bytes: new Uint8Array(MAX_FILE_BYTES + 1) },
    ])
    expect(outcome).toEqual({
      status: 'imported',
      root: 'pack',
      files: ['pack/a.json'],
      skipped: [
        { path: 'pack/.DS_Store', reason: 'system' },
        { path: 'pack/__MACOSX/a.json', reason: 'system' },
        { path: 'pack/../escape.json', reason: 'unsafePath' },
        { path: 'pack/a\\b.json', reason: 'unsafePath' },
        { path: 'pack//c.json', reason: 'unsafePath' },
        { path: 'pack/big.bin', reason: 'tooLarge' },
      ],
    })
    expect(await paths(store)).toEqual(['pack/a.json'])
  })

  it('puts loose files under `Imported`', async () => {
    const store = storeOf()
    expect(await importFolder(store, [{ path: 'a.json', bytes: bytes('{}') }])).toMatchObject({
      root: 'Imported',
      files: ['Imported/a.json'],
    })
  })

  it('refuses an empty pick', async () => {
    expect(await importFolder(storeOf(), [])).toEqual({
      status: 'refused',
      reason: 'empty',
      message: 'There are no files to import.',
    })
  })

  it('stops at a store that refuses, and says what was written', async () => {
    const store = storeOf()
    let writes = 0
    const full: ProjectStore = {
      ...store,
      write: (path, data, expected) =>
        ++writes > 1
          ? Promise.resolve({ ok: false, reason: 'quota', message: 'full' })
          : store.write(path, data, expected),
    }
    expect(
      await importFolder(full, [
        { path: 'p/a.json', bytes: bytes('{}') },
        { path: 'p/b.json', bytes: bytes('{}') },
        { path: 'p/c.json', bytes: bytes('{}') },
      ]),
    ).toEqual({ status: 'failed', root: 'p', written: ['p/a.json'], reason: 'quota', message: 'full' })
    const throwing: ProjectStore = { ...store, list: () => Promise.reject(new StorageError('denied', 'no')) }
    expect(await importFolder(throwing, [{ path: 'q/a.json', bytes: bytes('{}') }])).toEqual({
      status: 'failed',
      root: 'q',
      written: [],
      reason: 'denied',
      message: 'no',
    })
  })
})

describe('importZip', () => {
  it('keeps the one top folder a zip has', async () => {
    const store = storeOf()
    const zip = zipSync({
      'blockout-clinic/': {},
      'blockout-clinic/blockout.json': strToU8('{"b": 2}'),
      '__MACOSX/blockout-clinic/._blockout.json': strToU8('x'),
    })
    expect(await importZip(store, 'clinic.zip', zip)).toEqual({
      status: 'imported',
      root: 'blockout-clinic',
      files: ['blockout-clinic/blockout.json'],
      skipped: [{ path: '__MACOSX/blockout-clinic/._blockout.json', reason: 'system' }],
    })
    expect(textOf(await store.read('blockout-clinic/blockout.json'))).toBe('{"b": 2}')
  })

  it('puts a flat zip under its own name', async () => {
    const store = storeOf()
    const zip = zipSync({ 'a.json': strToU8('{}'), 'art/b.json': strToU8('{}') })
    expect(await importZip(store, 'Level pack.zip', zip)).toMatchObject({
      status: 'imported',
      root: 'Level pack',
      files: ['Level pack/a.json', 'Level pack/art/b.json'],
    })
  })

  it('refuses bytes that are not a zip', async () => {
    const outcome = await importZip(storeOf(), 'x.zip', bytes('not a zip'))
    expect(outcome.status === 'refused' && outcome.reason).toBe('notZip')
  })

  it('refuses a zip with no files', async () => {
    expect(await importZip(storeOf(), 'x.zip', zipSync({ 'only/': {} }))).toMatchObject({
      status: 'refused',
      reason: 'empty',
    })
  })

  it('never inflates an entry whose declared size is over 16 MB', async () => {
    const zip = zipSync(
      { 'p/big.bin': new Uint8Array(MAX_FILE_BYTES + 1), 'p/a.json': strToU8('{}') },
      { level: 9 },
    )
    // The big entry is first: its data starts after the 30-byte local header and its name. A reserved block type there
    // makes inflating it throw, so only a skip that comes before inflating gets past it.
    const corrupt = zip.slice()
    corrupt[30 + 'p/big.bin'.length] = 0xff
    expect(await importZip(storeOf(), 'p.zip', corrupt)).toMatchObject({
      status: 'imported',
      skipped: [{ path: 'p/big.bin', reason: 'tooLarge' }],
    })
  })

  it('refuses a zip of more than 10,000 entries', async () => {
    const files: Record<string, Uint8Array> = {}
    for (let n = 0; n <= MAX_ZIP_ENTRIES; n += 1) files[`p/${n}.txt`] = new Uint8Array()
    const outcome = await importZip(storeOf(), 'p.zip', zipSync(files, { level: 0 }))
    expect(outcome.status === 'refused' && outcome.reason).toBe('tooLarge')
    expect(MAX_ZIP_ENTRIES).toBe(10_000)
  })

  it('refuses a zip whose entries declare more than 256 MB in all, and writes nothing', async () => {
    const files: Record<string, Uint8Array> = {}
    for (let n = 0; n < 20; n += 1) files[`p/${n}.bin`] = strToU8('x')
    const zip = zipSync(files, { level: 0 })
    // Each central directory entry (signature 50 4b 01 02) says its file is 15 MB: 300 MB in all.
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
    for (let at = 0; at + 46 <= zip.byteLength; at += 1)
      if (view.getUint32(at, true) === 0x02014b50) view.setUint32(at + 24, 15 * 1024 * 1024, true)
    const store = storeOf()
    const outcome = await importZip(store, 'p.zip', zip)
    expect(outcome.status === 'refused' && outcome.reason).toBe('tooLarge')
    expect(MAX_ZIP_BYTES).toBe(256 * 1024 * 1024)
    expect(await paths(store)).toEqual([])
  })

  it('skips an entry whose declared size is over 16 MB without inflating it', async () => {
    const store = storeOf()
    const zip = zipSync({ 'p/big.bin': new Uint8Array(MAX_FILE_BYTES + 1), 'p/a.json': strToU8('{}') })
    expect(await importZip(store, 'p.zip', zip)).toEqual({
      status: 'imported',
      root: 'p',
      files: ['p/a.json'],
      skipped: [{ path: 'p/big.bin', reason: 'tooLarge' }],
    })
  })
})

describe('an imported checkout', () => {
  it('lists and opens the levels in it', async () => {
    const clock = createTestClock()
    const workspace = memoryWorkspace(clock)
    const app = createEditorApp({ workspace, clock })
    const zip = zipSync({ 'art/depot/depot.json': strToU8(loadAuthored('depot.af-sector')) })
    expect(await app.importZip('art.zip', zip)).toMatchObject({ status: 'imported', root: 'art' })
    expect((await app.list()).map((entry) => entry.path)).toEqual(['art/depot/depot.json'])
    const opened = await app.open('art/depot/depot.json')
    expect(opened.status).toBe('opened')
    expect(
      await app.importFolder([
        { path: 'art/annex/annex.json', bytes: bytes(loadAuthored('depot.af-sector')) },
      ]),
    ).toMatchObject({ root: 'art 2' })
  })
})
