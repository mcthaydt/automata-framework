import type { Hosting } from '@mcthaydt/automata-host'
import { describe, expect, it } from 'vitest'
import { failureHost } from './failure-host.js'

type Capability = Hosting['granted'] extends ReadonlySet<infer Each> ? Each : never

const session = (kind: 'ruken' | 'standalone', granted: readonly Capability[]) => ({
  kind,
  granted: new Set(granted),
})

describe('failureHost: what the boot-failure panel knows of the host (PUB spec §3, §3.1)', () => {
  it('before Hosting exists, the page is standalone, named "this page", with no exit', () => {
    expect(failureHost(null)).toEqual({ hostKind: 'standalone', hostName: 'this page', canExit: false })
  })

  it('a Ruken session that granted exit offers Back to Ruken', () => {
    expect(failureHost(session('ruken', ['lifecycle', 'exit']))).toEqual({
      hostKind: 'ruken',
      hostName: 'Ruken',
      canExit: true,
    })
  })

  it('a session without the exit grant never offers Back to …', () => {
    expect(failureHost(session('ruken', ['lifecycle'])).canExit).toBe(false)
    expect(failureHost(session('standalone', [])).canExit).toBe(false)
  })

  it("the SDK's standalone session is named for the page, not Ruken", () => {
    expect(failureHost(session('standalone', [])).hostName).toBe('this page')
  })
})
