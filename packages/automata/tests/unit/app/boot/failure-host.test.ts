import { describe, expect, it } from 'vitest'
import { failureHost } from '#src/app/boot/failure-host.ts'
import type { Hosting } from '#src/shared/host/hosting.ts'

type Capability = Hosting['granted'] extends ReadonlySet<infer Each> ? Each : never

const session = (kind: 'ruken' | 'standalone' | 'web', hostName: string, granted: readonly Capability[]) => ({
  kind,
  hostName,
  granted: new Set(granted),
})

describe('failureHost: what the boot-failure panel knows of the host (PUB spec §3, §3.1)', () => {
  it('before Hosting exists, the page is standalone, named "this page", with no exit', () => {
    expect(failureHost(null)).toEqual({ hostKind: 'standalone', hostName: 'this page', canExit: false })
  })

  it('a Ruken session that granted exit offers Back to Ruken', () => {
    expect(failureHost(session('ruken', 'Ruken', ['lifecycle', 'exit']))).toEqual({
      hostKind: 'ruken',
      hostName: 'Ruken',
      canExit: true,
    })
  })

  it('a session without the exit grant never offers Back to …', () => {
    expect(failureHost(session('ruken', 'Ruken', ['lifecycle'])).canExit).toBe(false)
    expect(failureHost(session('standalone', 'this page', [])).canExit).toBe(false)
  })

  it("the SDK's standalone session is named for the page, not Ruken", () => {
    expect(failureHost(session('standalone', 'this page', [])).hostName).toBe('this page')
  })

  // PUB.1: the web adapter names its host itself, and its failures draw as standalone: ui's HostKind names only
  // Ruken's two kinds, and a page outside Ruken has no host to go back to.
  it("a web session is named by the host and draws as standalone, whatever 'exit' says", () => {
    expect(failureHost(session('web', 'itch.io', ['lifecycle']))).toEqual({
      hostKind: 'standalone',
      hostName: 'itch.io',
      canExit: false,
    })
    expect(failureHost(session('web', 'this page', [])).hostName).toBe('this page')
  })

  it('a desktop session draws as tauri, named for the game, with Quit when exit is granted (DIST spec §8 flow 2)', () => {
    expect(failureHost({ kind: 'tauri', hostName: 'Cinder', granted: new Set(['exit']) })).toEqual({
      hostKind: 'tauri',
      hostName: 'Cinder',
      canExit: true,
    })
  })
})
