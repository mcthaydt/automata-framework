// @vitest-environment jsdom
import { clearMocks, mockIPC, mockWindows } from '@tauri-apps/api/mocks'
import { afterEach, describe, expect, it } from 'vitest'
import { tauriDesktop } from '#src/features/targets/tauri/desktop-tauri.ts'

// The real desktop port (DIST spec §6.1) over Tauri's IPC, mocked: each call reaches the plugin command it should.
// The adapter's behavior is tested over a fake port in `hosting-tauri.test.ts`.

afterEach(() => clearMocks())

/** Records every IPC command, answering the store plugin as a one-file store would. */
function recordIpc(shouldMockEvents = true) {
  const commands: { cmd: string; args: Record<string, unknown> }[] = []
  const entries = new Map<string, unknown>()
  mockIPC(
    (cmd, payload) => {
      const args = (payload ?? {}) as Record<string, unknown>
      commands.push({ cmd, args })
      switch (cmd) {
        case 'plugin:store|load':
          return 7
        case 'plugin:store|get':
          return [entries.get(args.key as string) ?? null, entries.has(args.key as string)]
        case 'plugin:store|set':
          entries.set(args.key as string, args.value)
          return null
        case 'plugin:store|delete':
          return entries.delete(args.key as string)
        case 'plugin:store|keys':
          return [...entries.keys()]
        default:
          return null
      }
    },
    { shouldMockEvents },
  )
  return { commands, names: () => commands.map((command) => command.cmd) }
}

describe('tauriDesktop', () => {
  it('opens saves.json in the app data folder without auto-save, and reads and writes through the store plugin', async () => {
    const ipc = recordIpc()
    const store = await tauriDesktop().loadStore()
    await store.set('progress', 'level-2')
    expect(await store.get('progress')).toBe('level-2')
    expect(await store.keys()).toEqual(['progress'])
    expect(await store.delete('progress')).toBe(true)
    await store.save()
    expect(ipc.commands[0]).toMatchObject({ cmd: 'plugin:store|load', args: { path: 'saves.json' } })
    expect(ipc.commands[0]?.args.options).toMatchObject({ autoSave: false })
    expect(ipc.names()).toEqual([
      'plugin:store|load',
      'plugin:store|set',
      'plugin:store|get',
      'plugin:store|keys',
      'plugin:store|delete',
      'plugin:store|save',
    ])
  })

  it('quits through the process plugin with exit code 0', async () => {
    const ipc = recordIpc()
    await tauriDesktop().exitApp()
    expect(ipc.commands).toEqual([{ cmd: 'plugin:process|exit', args: { code: 0 } }])
  })

  it("listens for the window's close request on the current window", async () => {
    mockWindows('main')
    const ipc = recordIpc(false)
    await tauriDesktop().onCloseRequested(() => {})
    const listen = ipc.commands.find((command) => command.cmd === 'plugin:event|listen')
    expect(listen?.args).toMatchObject({ event: 'tauri://close-requested' })
  })
})
