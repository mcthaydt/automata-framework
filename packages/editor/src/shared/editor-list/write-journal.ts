// The change set side of the write path: opening the change set before the first write (asking for its title), the
// measure checks' values from before that write, and the journal entries each check run leaves. Plain TypeScript.
import type { ChangeSetCheck, CheckMeasure, CheckResult, SuitePorts } from '../kit/ports/suite-ports.ts'

export interface WriteJournalOptions {
  readonly ports: SuitePorts
  /** The title prompt; `undefined` when the person cancels. */
  readonly title: () => Promise<string | undefined>
  /** Called once a change set has begun, because the histories before it no longer apply. */
  readonly onBegin: () => void
}

export interface WriteJournal {
  /** The declared checks among `ids` that run `when`. */
  declaredFor(ids: readonly string[], when: 'before' | 'after'): ReturnType<SuitePorts['checks']['declared']>
  /** Opens a change set when the port is there and none is; false when the person cancels the title. */
  ensureChangeSet(checkIds: readonly string[]): Promise<boolean>
  /** A check run's results as change set entries, each measure with its value before the first write and now. */
  journal(results: readonly CheckResult[]): ChangeSetCheck[]
}

export function createWriteJournal({ ports, title, onBegin }: WriteJournalOptions): WriteJournal {
  const { changeSet, checks } = ports
  /** Each measure check's measures before the open change set's first write. */
  let baseline = new Map<string, readonly CheckMeasure[]>()

  const declaredFor: WriteJournal['declaredFor'] = (ids, when) =>
    checks.declared().filter((check) => check.when === when && ids.includes(check.id))

  return {
    declaredFor,
    async ensureChangeSet(checkIds) {
      if (changeSet === undefined || (await changeSet.current()) !== undefined) return true
      const named = await title()
      if (named === undefined) return false
      await changeSet.begin(named)
      onBegin()
      // The measure checks' values before any write: the "before" the pill and the Review desk compare with.
      const measures = declaredFor(checkIds, 'after').filter((check) => check.measure)
      const results =
        measures.length === 0 ? [] : await (await checks.run({ checks: measures.map((c) => c.id) })).result()
      baseline = new Map(
        results.flatMap((result) => (result.measure === undefined ? [] : [[result.check, result.measure]])),
      )
      return true
    },
    journal: (results) =>
      results.map(({ check, status, findings, measure }) => ({
        check,
        status,
        findings,
        ...(measure === undefined ? {} : { before: baseline.get(check) ?? measure, after: measure }),
      })),
  }
}
