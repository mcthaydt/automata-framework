import { describe, expect, test } from 'vitest'
import { createFolderStore, pickFolder, restoreFolder } from '#src/shared/kit/storage/folder.ts'
import { createFakeFolder, domError } from '#src/testing/kit/fake-fs.ts'
import { createMemoryVault } from '#src/testing/kit/memory-vault.ts'
import { describeProjectStore } from '#src/testing/kit/store-contract.ts'

describeProjectStore('folder', () => createFolderStore(createFakeFolder()))

describe('folder store', () => {
  test('is a folder store named after the folder', () => {
    const store = createFolderStore(createFakeFolder())
    expect(store.kind).toBe('folder')
    expect(typeof store.name).toBe('string')
  })

  test('reads and writes while permission is granted', async () => {
    const store = createFolderStore(createFakeFolder({ permission: 'granted' }))
    expect((await store.write('a.txt', 'x')).ok).toBe(true)
    expect(await store.list()).toHaveLength(1)
  })

  test('an unasked permission is denied on every call, and nothing is written', async () => {
    const folder = createFakeFolder({ permission: 'prompt' })
    const store = createFolderStore(folder)
    expect(await store.write('a.txt', 'x')).toMatchObject({ ok: false, reason: 'denied' })
    await expect(store.read('a.txt')).rejects.toMatchObject({ reason: 'denied' })
    await expect(store.list()).rejects.toMatchObject({ reason: 'denied' })
    await expect(store.remove('a.txt')).rejects.toMatchObject({ reason: 'denied' })
    await expect(folder.getFileHandle('a.txt')).rejects.toMatchObject({ name: 'NotFoundError' })
  })

  test('the message tells the person what to do', async () => {
    const asked = createFolderStore(createFakeFolder({ permission: 'prompt' }))
    const refused = createFolderStore(createFakeFolder({ permission: 'denied' }))
    const a = await asked.write('a.txt', 'x')
    const r = await refused.write('a.txt', 'x')
    expect(a.ok === false && a.message).toMatch(/granted again/i)
    expect(r.ok === false && r.message).toMatch(/refused/i)
  })

  test('permission revoked after the folder worked is denied from then on (the edits stay in history)', async () => {
    const folder = createFakeFolder({ permission: 'granted' })
    const store = createFolderStore(folder)
    await store.write('a.txt', 'x')
    folder.permission = 'denied'
    expect(await store.write('a.txt', 'y')).toMatchObject({ ok: false, reason: 'denied' })
  })

  test('requestAccess asks the browser, and the store works after a grant', async () => {
    const folder = createFakeFolder({ permission: 'prompt' })
    folder.answerToPrompt = 'granted'
    const store = createFolderStore(folder)
    expect(await store.requestAccess()).toBe(true)
    expect((await store.write('a.txt', 'x')).ok).toBe(true)
  })

  test('requestAccess is false when the person says no, and the store stays denied', async () => {
    const folder = createFakeFolder({ permission: 'prompt' })
    folder.answerToPrompt = 'denied'
    const store = createFolderStore(folder)
    expect(await store.requestAccess()).toBe(false)
    expect(await store.write('a.txt', 'x')).toMatchObject({ ok: false, reason: 'denied' })
  })

  test('requestAccess is false when the browser refuses to ask (no user gesture)', async () => {
    const folder = createFakeFolder({ permission: 'prompt' })
    folder.requestPermission = async () => {
      throw domError('SecurityError', 'User activation is required.')
    }
    expect(await createFolderStore(folder).requestAccess()).toBe(false)
  })

  test('a handle without permission methods is treated as granted', async () => {
    const folder = createFakeFolder()
    const bare = { ...folder, queryPermission: undefined, requestPermission: undefined }
    const store = createFolderStore(Object.assign(Object.create(folder), bare))
    expect((await store.write('a.txt', 'x')).ok).toBe(true)
    expect(await store.requestAccess()).toBe(true)
  })

  test('asks for readwrite access, not read', async () => {
    const folder = createFakeFolder()
    const asked: unknown[] = []
    folder.queryPermission = async (descriptor) => {
      asked.push(descriptor)
      return 'granted'
    }
    await createFolderStore(folder).list()
    expect(asked).toEqual([{ mode: 'readwrite' }])
  })
})

describe('pickFolder', () => {
  test('opens the picker for readwrite, remembers the handle under its name and returns the store', async () => {
    const vault = createMemoryVault()
    const folder = createFakeFolder()
    const requested: unknown[] = []
    const store = await pickFolder(vault, {
      showDirectoryPicker: async (options) => {
        requested.push(options)
        return folder
      },
    })
    expect(requested).toEqual([{ mode: 'readwrite' }])
    expect(store?.kind).toBe('folder')
    expect(await vault.names()).toEqual([folder.name])
    expect(await vault.load(folder.name)).toBe(folder)
  })

  test('a dismissed picker is not an error', async () => {
    const vault = createMemoryVault()
    const store = await pickFolder(vault, {
      showDirectoryPicker: async () => {
        throw domError('AbortError', 'The user aborted a request.')
      },
    })
    expect(store).toBeUndefined()
    expect(await vault.names()).toEqual([])
  })

  test('a browser without a picker gives nothing, without throwing', async () => {
    expect(await pickFolder(createMemoryVault(), {})).toBeUndefined()
  })

  test('a picker that fails for another reason rejects with a StorageError', async () => {
    const error = await pickFolder(createMemoryVault(), {
      showDirectoryPicker: async () => {
        throw domError('SecurityError', 'Must be handling a user gesture.')
      },
    }).catch((caught: unknown) => caught)
    expect(error).toMatchObject({
      name: 'StorageError',
      reason: 'denied',
      message: 'Must be handling a user gesture.',
    })
  })

  test('a vault that cannot save does not take the folder away: it only will not be remembered', async () => {
    const vault = createMemoryVault()
    vault.failNextSave(domError('QuotaExceededError', 'No room.'))
    const store = await pickFolder(vault, { showDirectoryPicker: async () => createFakeFolder() })
    expect(store?.kind).toBe('folder')
    expect(await vault.names()).toEqual([])
  })
})

describe('restoreFolder', () => {
  test('returns a store for a remembered folder, which asks for permission when it is used', async () => {
    const vault = createMemoryVault()
    const folder = createFakeFolder({ permission: 'prompt' })
    await vault.save('Stages', folder)
    const store = await restoreFolder(vault, 'Stages')
    expect(store?.kind).toBe('folder')
    expect(await store?.write('a.txt', 'x')).toMatchObject({ ok: false, reason: 'denied' })
  })

  test('an unknown name gives nothing', async () => {
    expect(await restoreFolder(createMemoryVault(), 'Nothing')).toBeUndefined()
  })
})
