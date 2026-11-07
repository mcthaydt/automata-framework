import type { Capability } from '../../shared/host/capability.schema.ts'
import type { ErrorCode } from '../../shared/host/error-code.schema.ts'
import type { Hosting } from '../../shared/host/hosting.ts'

/** The four distribution targets a fake host can stand in for. */
export type FakeTarget = 'web' | 'itch' | 'ruken' | 'tauri'

/** What every target grants a page: it can always observe these. */
const OBSERVED: readonly Capability[] = ['lifecycle', 'input', 'display', 'audio']

/**
 * What each target grants by default. The web targets add saves; the desktop also quits. Ruken grants
 * what the game asks for (`wants`), as its fake host does by default.
 */
export function defaultGrants(target: FakeTarget, wants: readonly Capability[]): ReadonlySet<Capability> {
  switch (target) {
    case 'web':
    case 'itch':
      return new Set([...OBSERVED, 'saves'])
    case 'tauri':
      return new Set([...OBSERVED, 'saves', 'exit'])
    case 'ruken':
      return new Set([...OBSERVED, ...wants])
  }
}

/**
 * The code an ungranted call fails with: `DENIED` where the target offers the
 * capability but this session does not have it (saves on the web and desktop targets: blocked storage, an
 * unreadable store), `UNSUPPORTED` where the target does not offer it at all.
 */
export function ungrantedCode(target: FakeTarget, capability: Capability): ErrorCode {
  return capability === 'saves' && target !== 'ruken' ? 'DENIED' : 'UNSUPPORTED'
}

/** `Hosting.kind` for each target. */
export function kindOf(target: FakeTarget): Hosting['kind'] {
  return target === 'itch' ? 'web' : target
}

/** `Hosting.hostName` for each target; the desktop names the game. */
export function hostNameOf(target: FakeTarget, title: string): string {
  switch (target) {
    case 'web':
      return 'this page'
    case 'itch':
      return 'itch.io'
    case 'ruken':
      return 'Ruken'
    case 'tauri':
      return title
  }
}
