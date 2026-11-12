import type { OpeningContext, OpeningStep } from '@automata/framework'
import { type BuildFacts, checkServerVersion } from '@automata/net'
import { mount, unmount } from 'svelte'
import { type StaleCopy, staleWords } from '../../shared/words/stale-copy'
import StaleBuild from './StaleBuild.svelte'

export type { StaleCopy } from '../../shared/words/stale-copy'

/** How a game sets up its stale-build check. */
export interface StaleBuildOptions {
  /** The game's own build facts: what it joins with (`PROTOCOL_VERSION`, and the schema and content hashes). */
  readonly facts: BuildFacts
  /**
   * The game's own fetch of `<server>/version`. Anything it throws, or answers in a shape the check does not know,
   * lets the title through and is logged to the console as a check that could not run. (A server on another origin
   * must answer with CORS headers, or the browser refuses the answer to the page; `@automata/net-server` does.)
   */
  readonly fetchFacts: () => Promise<unknown>
  /** The longest the title waits for the answer, in milliseconds, on the runtime's clock. Default 1500. */
  readonly waitMs?: number
  /** What Reload does. Default: reloads the page. */
  readonly reload?: () => void
  /** The panel's words: fixed, or for a locale. Default: this package's, in the player's language. */
  readonly copy?: StaleCopy | ((locale: string) => StaleCopy)
}

const DEFAULT_WAIT_MS = 1500

/**
 * An opening step that asks the server for its build facts before an online game's title. Current, or slower than
 * `waitMs` (a later answer is dropped): it resolves and the title follows. Unreadable: the same, with a console line
 * saying the check could not run, so a broken probe is seen by the maker rather than read as a pass. Stale: it shows the
 * error with Reload and stays, so the title of an out-of-date tab is never reached. The join check stays the authority;
 * this only says so before the player has tried to join.
 */
export function staleBuildStep(options: StaleBuildOptions): OpeningStep {
  const waitMs = options.waitMs ?? DEFAULT_WAIT_MS
  const reload = options.reload ?? (() => globalThis.location.reload())
  return ({ layer, services, signal }: OpeningContext) => {
    if (signal.aborted) return Promise.resolve()
    const { clock, locale } = services
    return new Promise<void>((resolve) => {
      let finished = false
      let screen: ReturnType<typeof mount> | undefined
      // The one way out: the verdict says current, the wait ran out, or the runtime shut down.
      const finish = (): void => {
        if (finished) return
        finished = true
        clock.clearTimeout(timer)
        signal.removeEventListener('abort', finish)
        if (screen !== undefined) void unmount(screen)
        resolve()
      }
      const timer = clock.setTimeout(finish, waitMs)
      signal.addEventListener('abort', finish, { once: true })
      void checkServerVersion(options.fetchFacts, options.facts).then((verdict) => {
        // A verdict that comes after the step ended is dropped: the join check refuses a stale tab anyway.
        if (verdict === 'unchecked' && !finished)
          console.warn(
            'Could not check whether this tab is up to date: the server answered nothing readable on /version. The join still checks it.',
          )
        if (finished || verdict !== 'stale') return finish()
        clock.clearTimeout(timer)
        const words =
          typeof options.copy === 'function'
            ? options.copy(locale.current)
            : (options.copy ?? staleWords(locale.current))
        screen = mount(StaleBuild, { target: layer, props: { copy: words, onReload: reload } })
      })
    })
  }
}
