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
 * The name is the host's own (`Hosting.hostName`, PUB.1). A `web` session (PUB spec §3) draws as standalone:
 * ui's `HostKind` names only Ruken's two kinds, and a page outside Ruken has no host to go back to.
 */
export function failureHost(
  hosting: Pick<Hosting, 'kind' | 'hostName' | 'granted'> | null | undefined,
): FailureHost {
  if (!hosting) return { hostKind: 'standalone', hostName: 'this page', canExit: false }
  return {
    hostKind: hosting.kind === 'ruken' ? 'ruken' : 'standalone',
    hostName: hosting.hostName,
    canExit: hosting.granted.has('exit'),
  }
}
