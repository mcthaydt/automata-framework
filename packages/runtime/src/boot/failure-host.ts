import type { Hosting } from '@mcthaydt/automata-host'
import type { HostKind } from '@mcthaydt/automata-ui'

/** What the boot-failure panel needs to know about the host: its kind, its name and whether it can be left. */
export interface FailureHost {
  readonly hostKind: HostKind
  /** Fills "Back to {host}". */
  readonly hostName: string
  /** The host granted `exit`; without it "Back to …" is hidden (PUB spec §3.1). */
  readonly canExit: boolean
}

/**
 * The panel's view of the host, or of the page before Hosting exists (then nothing can be exited).
 *
 * `hostName` belongs to `Hosting` (PUB.1 adds `Hosting.hostName`). Until that lands, a Ruken session is named
 * 'Ruken' and anything else 'this page'; once it does, this reads `hosting.hostName` instead.
 */
export function failureHost(hosting: Pick<Hosting, 'kind' | 'granted'> | null | undefined): FailureHost {
  if (!hosting) return { hostKind: 'standalone', hostName: 'this page', canExit: false }
  return {
    hostKind: hosting.kind,
    hostName: hosting.kind === 'ruken' ? 'Ruken' : 'this page',
    canExit: hosting.granted.has('exit'),
  }
}
