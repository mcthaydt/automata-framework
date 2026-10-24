import { describe, expect, test } from 'vitest'
import { createFakeOpfs, domError } from '../testing/fake-fs'
import { openWorkspace } from './workspace'

const decode = (bytes: Uint8Array | undefined): string | undefined =>
  bytes === undefined ? undefined : new TextDecoder().decode(bytes)

describe('openWorkspace', () => {
  test('with working storage, the workspace and the journal are OPFS directories side by side (EK-d)', async () => {
    const root = createFakeOpfs()
    const workspace = await openWorkspace({ storage: { getDirectory: async () => root } })
    expect(workspace.persistent).toBe(true)
    expect(workspace.reason).toBeUndefined()
    expect(workspace.store.kind).toBe('opfs')
    expect(workspace.journal.kind).toBe('opfs')
    await workspace.store.write('stages/a.toml', 'x')
    await workspace.journal.write('stages/a.toml.autosave', 'y')
    const dirs = [] as string[]
    for await (const [name] of root.entries()) dirs.push(name)
    expect(dirs.sort()).toEqual(['journal', 'workspace'])
    expect((await workspace.store.list()).map((entry) => entry.path)).toEqual(['stages/a.toml'])
    expect((await workspace.journal.list()).map((entry) => entry.path)).toEqual(['stages/a.toml.autosave'])
  })

  test('leaves no probe file behind', async () => {
    const root = createFakeOpfs()
    const workspace = await openWorkspace({ storage: { getDirectory: async () => root } })
    expect(await workspace.store.list()).toEqual([])
    expect(await workspace.journal.list()).toEqual([])
  })

  test('a second visit finds what the first one kept', async () => {
    const root = createFakeOpfs()
    await (await openWorkspace({ storage: { getDirectory: async () => root } })).store.write('a.txt', 'kept')
    const again = await openWorkspace({ storage: { getDirectory: async () => root } })
    expect(decode(await again.store.read('a.txt'))).toBe('kept')
  })

  test('without OPFS it falls back to memory and says so (EK-f)', async () => {
    const workspace = await openWorkspace({ storage: {} })
    expect(workspace.persistent).toBe(false)
    expect(workspace.store.kind).toBe('memory')
    expect(workspace.journal.kind).toBe('memory')
    expect(workspace.reason).toMatch(/no private file storage/i)
    await workspace.store.write('a.txt', 'x')
    expect(decode(await workspace.store.read('a.txt'))).toBe('x')
  })

  test('a browser that refuses OPFS (a private window) falls back with the browser’s reason', async () => {
    const workspace = await openWorkspace({
      storage: {
        getDirectory: async () => {
          throw domError('SecurityError', 'Storage is not allowed in a private window.')
        },
      },
    })
    expect(workspace.persistent).toBe(false)
    expect(workspace.store.kind).toBe('memory')
    expect(workspace.reason).toContain('Storage is not allowed in a private window.')
  })

  test('OPFS that opens but cannot write (old Safari private mode) falls back', async () => {
    const root = createFakeOpfs()
    root.controls.failNext('write', domError('QuotaExceededError', 'The quota has been exceeded.'))
    const workspace = await openWorkspace({ storage: { getDirectory: async () => root } })
    expect(workspace.persistent).toBe(false)
    expect(workspace.store.kind).toBe('memory')
    expect(workspace.reason).toContain('The quota has been exceeded.')
  })

  test('OPFS that writes but cannot read back falls back', async () => {
    const root = createFakeOpfs()
    root.controls.failNext('getFile', domError('NotAllowedError', 'Reading is blocked.'))
    const workspace = await openWorkspace({ storage: { getDirectory: async () => root } })
    expect(workspace.persistent).toBe(false)
    expect(workspace.reason).toContain('Reading is blocked.')
  })

  test('OPFS that writes but loses the file falls back', async () => {
    const root = createFakeOpfs()
    const lossy = new Proxy(root, {
      get(target, property) {
        if (property !== 'getDirectoryHandle') return Reflect.get(target, property)
        return async (name: string, options?: { create?: boolean }) => {
          const dir = await target.getDirectoryHandle(name, options)
          return new Proxy(dir, {
            get(inner, key) {
              if (key !== 'getFileHandle') return Reflect.get(inner, key)
              return async (file: string, opts?: { create?: boolean }) => {
                if (file === 'probe.txt' && opts?.create !== true) throw domError('NotFoundError', 'Gone.')
                return inner.getFileHandle(file, opts)
              }
            },
          })
        }
      },
    })
    const workspace = await openWorkspace({ storage: { getDirectory: async () => lossy } })
    expect(workspace.persistent).toBe(false)
    expect(workspace.reason).toMatch(/could not be read/i)
  })

  test('the fallback stores are independent of each other', async () => {
    const workspace = await openWorkspace({ storage: {} })
    await workspace.store.write('a.txt', 'x')
    expect(await workspace.journal.list()).toEqual([])
  })

  test('exports are a download store whether or not OPFS works', async () => {
    const downloads: string[] = []
    const download = {
      now: () => 1,
      download: (file: { name: string }) => {
        downloads.push(file.name)
      },
    }
    const good = await openWorkspace({ storage: { getDirectory: async () => createFakeOpfs() }, download })
    const bad = await openWorkspace({ storage: {}, download })
    expect(good.exports.kind).toBe('download')
    expect(bad.exports.kind).toBe('download')
    await bad.exports.write('stages/a.toml', 'x')
    expect(downloads).toEqual(['a.toml'])
  })
})
