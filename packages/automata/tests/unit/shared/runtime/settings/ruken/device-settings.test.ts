import { settle } from '@ruken/sdk-host/testing'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { type DeviceStorage, liveDeviceStorage } from '#src/shared/runtime/settings/device-storage.ts'
import { type SettingsDef, writeSettings } from '#src/shared/runtime/settings/migrate-settings.ts'
import { createSettings, type Settings } from '#src/shared/runtime/settings/settings.manager.ts'
import { withHostingTest } from '#src/testing/host/page/ruken/hosting-test.ts'

// Settings fields a game keeps on the device instead of in the player's saves (M5 spec §4.5, M5-D4). The cases:
// "sound stays on the device inside Ruken"
// (Owner, 2026-10-10: "muting a Mac must not mute the same player's iPad").

interface Mixed {
  readonly name: string
  readonly audio: { readonly muted: boolean; readonly music: number }
  readonly locale: string
}

const AUDIO_DEFAULT = { muted: false, music: 1 }
const mixed: SettingsDef<Mixed> = {
  key: 'mixed',
  version: 1,
  schema: z.object({
    name: z.string().catch('Player'),
    audio: z.object({ muted: z.boolean().catch(false), music: z.number().catch(1) }).catch(AUDIO_DEFAULT),
    locale: z.string().catch('en'),
  }),
  defaults: { name: 'Player', audio: AUDIO_DEFAULT, locale: 'en' },
  deviceFields: ['audio'],
}

const DEVICE_KEY = 'mixed:device'

/** A device's storage that works, with what it already holds. */
function memoryDevice(
  initial: Record<string, string> = {},
): DeviceStorage & { readonly held: Map<string, string> } {
  const held = new Map(Object.entries(initial))
  return {
    held,
    get: (key) => held.get(key) ?? null,
    set: (key, value) => {
      held.set(key, value)
    },
    remove: (key) => {
      held.delete(key)
    },
  }
}

/** A device whose storage cannot be touched: every use throws, as a blocked `localStorage` does. */
const blockedDevice: DeviceStorage = {
  get: () => {
    throw new Error('SecurityError: the operation is insecure')
  },
  set: () => {
    throw new Error('SecurityError: the operation is insecure')
  },
  remove: () => {
    throw new Error('SecurityError: the operation is insecure')
  },
}

/** The store's value, typed: `Settings` holds every game's store as `unknown`. */
const current = (settings: Settings): Mixed => settings.store?.get() as Mixed

/** The `saves.set` payloads of one run, parsed. */
const writtenTo = (sent: unknown[]): { key: string; value: Record<string, unknown> }[] =>
  (sent as { key: string; value: string }[]).map(({ key, value }) => ({ key, value: JSON.parse(value) }))

describe('settings fields kept on the device', () => {
  it("keeps a change in the device's storage and out of the player's saves", async () => {
    const device = memoryDevice()
    await withHostingTest(async ({ hosting, handle }) => {
      const { sentByGame } = handle
      const settings = createSettings(mixed, null, hosting.saves, device)
      settings.store?.update((value) => ({ ...(value as Mixed), audio: { muted: true, music: 0.25 } }))
      await settle()
      expect(JSON.parse(device.held.get(DEVICE_KEY) ?? 'null')).toEqual({
        version: 1,
        audio: { muted: true, music: 0.25 },
      })
      for (const write of sentByGame('saves.set') as { value: string }[])
        expect(write.value).not.toMatch(/muted|music/)
    })
  })

  it('still sends every other field to the saves, in the same shape, without the device fields', async () => {
    const device = memoryDevice()
    await withHostingTest(async ({ hosting, handle }) => {
      const { sentByGame } = handle
      const settings = createSettings(mixed, null, hosting.saves, device)
      settings.store?.update((value) => ({
        ...(value as Mixed),
        audio: { muted: true, music: 1 },
        name: 'Kite',
        locale: 'ja',
      }))
      await settle()
      expect(writtenTo(sentByGame('saves.set'))).toEqual([
        { key: 'mixed', value: { version: 1, name: 'Kite', locale: 'ja' } },
      ])
    })
  })

  it("reads both back on the next launch: the device's fields from the device, the rest from the saves", async () => {
    const device = memoryDevice({
      [DEVICE_KEY]: JSON.stringify({ version: 1, audio: { muted: true, music: 0.5 } }),
    })
    const account = JSON.stringify({ version: 1, name: 'Kite', locale: 'ja' })
    await withHostingTest(async ({ hosting }) => {
      const settings = createSettings(mixed, account, hosting.saves, device)
      expect(settings.store?.get()).toEqual({
        name: 'Kite',
        locale: 'ja',
        audio: { muted: true, music: 0.5 },
      })
    })
  })

  it('does not carry a device field to a second device, though the rest follows', async () => {
    const account = JSON.stringify({ version: 1, name: 'Kite', locale: 'ja' })
    await withHostingTest(async ({ hosting }) => {
      const settings = createSettings(mixed, account, hosting.saves, memoryDevice())
      expect(settings.store?.get()).toEqual({ name: 'Kite', locale: 'ja', audio: AUDIO_DEFAULT })
    })
  })

  it("never reads the account's copy of a device field, and the next account write leaves it out", async () => {
    const old = writeSettings(mixed, { name: 'Kite', locale: 'ja', audio: { muted: true, music: 0.1 } })
    const device = memoryDevice()
    await withHostingTest(async ({ hosting, handle }) => {
      const { sentByGame } = handle
      const settings = createSettings(mixed, old, hosting.saves, device)
      expect(settings.store?.get()).toEqual({ name: 'Kite', locale: 'ja', audio: AUDIO_DEFAULT })

      settings.store?.update((value) => ({ ...(value as Mixed), name: 'Wren' }))
      await settle()
      expect(writtenTo(sentByGame('saves.set'))).toEqual([
        { key: 'mixed', value: { version: 1, name: 'Wren', locale: 'ja' } },
      ])
      // And this device now holds its own record: the defaults.
      expect(JSON.parse(device.held.get(DEVICE_KEY) ?? 'null')).toEqual({
        version: 1,
        audio: AUDIO_DEFAULT,
      })
    })
  })

  it('reads the device record through the same per-field fallbacks as any settings record', async () => {
    const device = memoryDevice({
      [DEVICE_KEY]: JSON.stringify({ version: 1, audio: { muted: 'yes', music: 0.3 } }),
    })
    await withHostingTest(async ({ hosting }) => {
      const settings = createSettings(mixed, null, hosting.saves, device)
      expect(current(settings).audio).toEqual({ muted: false, music: 0.3 })
    })
  })

  it('reads a damaged device record as the defaults, and an account record with a bad field one field at a time', async () => {
    await withHostingTest(async ({ hosting }) => {
      const account = JSON.stringify({ version: 1, name: 7, locale: 'ja' })
      const settings = createSettings(mixed, account, hosting.saves, memoryDevice({ [DEVICE_KEY]: '{oops' }))
      expect(settings.store?.get()).toEqual({ name: 'Player', locale: 'ja', audio: AUDIO_DEFAULT })
    })
  })

  it('does not write the account again for a change only the device keeps, once it has written it', async () => {
    await withHostingTest(async ({ hosting, handle }) => {
      const { sentByGame } = handle
      const settings = createSettings(mixed, null, hosting.saves, memoryDevice())
      for (const music of [0.9, 0.8, 0.7, 0.6])
        settings.store?.update((value) => ({ ...(value as Mixed), audio: { muted: false, music } }))
      await settle()
      // The first update writes the account (it has never been written this visit); the slider drags after it do not.
      expect(sentByGame('saves.set')).toHaveLength(1)
      settings.store?.update((value) => ({ ...(value as Mixed), locale: 'ja' }))
      await settle()
      expect(sentByGame('saves.set')).toHaveLength(2)
    })
  })

  it('plays on with a device whose storage cannot be touched: the change holds for the visit and is never saved instead (S-g)', async () => {
    await withHostingTest(async ({ hosting, handle }) => {
      const { host } = handle
      const settings = createSettings(mixed, null, hosting.saves, blockedDevice)
      expect(current(settings).audio).toEqual(AUDIO_DEFAULT)

      expect(() =>
        settings.store?.update((value) => ({
          ...(value as Mixed),
          audio: { muted: true, music: 0.4 },
          name: 'Kite',
        })),
      ).not.toThrow()
      expect(current(settings).audio).toEqual({ muted: true, music: 0.4 })
      await hosting.saves.flush()
      await settle()

      for (const slot of host.fakes.server.slots.values()) expect(slot.value).not.toMatch(/muted|music/)
      expect(JSON.parse(host.fakes.server.slots.get('mixed')?.value ?? 'null')).toEqual({
        version: 1,
        name: 'Kite',
        locale: 'en',
      })
    })
  })

  it('refuses a device field the settings do not have, which would silently stay in the saves', async () => {
    const typo = { ...mixed, deviceFields: ['audio', 'sound'] }
    await expect(
      withHostingTest(async ({ hosting }) => {
        createSettings(typo, null, hosting.saves, memoryDevice())
      }),
    ).rejects.toThrow(/'sound'/)
  })

  it('writes every field to the saves for a definition that declares no device fields, as before', async () => {
    const { deviceFields: _declared, ...plain } = mixed
    await withHostingTest(async ({ hosting, handle }) => {
      const { sentByGame } = handle
      const device = memoryDevice()
      const settings = createSettings(plain, null, hosting.saves, device)
      settings.store?.update((value) => ({ ...(value as Mixed), audio: { muted: true, music: 1 } }))
      await settle()
      expect(writtenTo(sentByGame('saves.set'))[0]?.value).toMatchObject({ audio: { muted: true } })
      expect(device.held.size).toBe(0)
    })
  })
})

describe('the frame’s own storage as a device', () => {
  const fakeWindow = (localStorage: Storage | (() => never)) =>
    Object.defineProperty({}, 'localStorage', {
      get: typeof localStorage === 'function' ? localStorage : () => localStorage,
    }) as Window

  const store = (): Storage => {
    const held = new Map<string, string>()
    return {
      getItem: (key) => held.get(key) ?? null,
      setItem: (key, value) => void held.set(key, String(value)),
      removeItem: (key) => void held.delete(key),
      clear: () => held.clear(),
      key: (index) => [...held.keys()][index] ?? null,
      get length() {
        return held.size
      },
    }
  }

  it("keeps a key under the game's prefix", () => {
    const storage = store()
    const device = liveDeviceStorage(fakeWindow(storage), 'blank-game')
    device?.set('settings:device', 'x')
    expect(storage.getItem('blank-game:settings:device')).toBe('x')
    expect(device?.get('settings:device')).toBe('x')
    device?.remove('settings:device')
    expect(storage.getItem('blank-game:settings:device')).toBeNull()
  })

  it('is no device at all where touching localStorage throws', () => {
    const blocked = fakeWindow(() => {
      throw new Error('SecurityError')
    })
    expect(liveDeviceStorage(blocked, 'blank-game')).toBeUndefined()
  })
})
