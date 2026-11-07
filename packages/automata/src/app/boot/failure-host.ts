import type { Hosting } from '../../shared/host/hosting.ts'
import type { HostKind } from '../../shared/ui/status/boot-failure.ts'

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
 * The name is the host's own (`Hosting.hostName`, PUB.1). A `web` session (PUB spec §3) draws as standalone: a page
 * has no host to go back to. A desktop session draws as `tauri`, whose exit action is Quit (DIST spec §8 flow 2).
 */
export function failureHost(
  hosting: Pick<Hosting, 'kind' | 'hostName' | 'granted'> | null | undefined,
): FailureHost {
  if (!hosting) return { hostKind: 'standalone', hostName: 'this page', canExit: false }
  return {
    hostKind: hosting.kind === 'ruken' || hosting.kind === 'tauri' ? hosting.kind : 'standalone',
    hostName: hosting.hostName,
    canExit: hosting.granted.has('exit'),
  }
}
