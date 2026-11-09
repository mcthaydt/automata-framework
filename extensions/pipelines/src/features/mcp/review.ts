import { Effect } from 'effect'
import { EXIT } from '../../shared/exit.ts'
import type { PipelineDef, StageServices } from '../../shared/pipeline.ts'
import { runPipeline } from '../../shared/runner.ts'
import type { GateRecord } from '../../shared/state.schema.ts'

// pipeline_request_review: the only way an
// agent brings a gate to a decision. It records that the gate was put to the person, then asks them through MCP
// elicitation: the client shows the person a form and returns their answer to the server, never through the model.
// Only an accepted form with a decision records one, through the runner's own approve or reject. Everything
// else (declined, cancelled, no decision, timed out, no elicitation in the client) leaves the gate pending.

/** The person's answer, as the server's elicitation port reports it. */
export type PersonAnswer =
  | { readonly kind: 'decided'; readonly decision: 'approve' | 'reject'; readonly note?: string | undefined }
  | {
      readonly kind: 'undecided'
      readonly why: 'declined' | 'cancelled' | 'no decision' | 'timed out' | string
    }

/** How the server reaches the person: whether the client can show a form, and the form itself. */
export interface Asker {
  readonly canAsk: () => boolean
  readonly ask: (message: string) => Effect.Effect<PersonAnswer>
}

/** A tool's answer: the exit code (0 and 3 are answers, others tool errors), the JSON data and the audit summary. */
export interface Answer {
  readonly exit: 0 | 1 | 2 | 3 | 4
  readonly data: unknown
  readonly summary: string
  /** The located target's real path: the audit line goes beside its nearest `pipeline.toml` (audit.ts). */
  readonly auditFrom?: string | undefined
  /** Units the spend ledger grew by during the call (pipeline_run). */
  readonly cost?: Readonly<Record<string, number>> | undefined
}

/** The review's outcome. */
export type ReviewOutcome = 'asked' | 'approved' | 'rejected' | 'already decided' | string

/** A word for a POSIX shell: as it is when it is plain, else in single quotes (a `'` inside becomes `'\''`). */
export const shellQuote = (word: string): string =>
  /^[A-Za-z0-9_./:=@%+-]+$/.test(word) ? word : `'${word.split("'").join("'\\''")}'`

const formMessage = (summary: string, gate: string): string =>
  `${summary}\n\nApprove or reject gate ${gate}? Your answer is recorded as the owner's decision.`

const failed = (error: string | undefined, exit: Answer['exit']): Answer => ({
  exit,
  data: { ok: false, exit, error },
  summary: error ?? `exit ${exit}`,
})

/** Puts `gate` on the target to the person, and records their decision if they make one. */
export const requestReview = (
  def: PipelineDef,
  target: { readonly abs: string; readonly rel: string },
  gate: string,
  asker: Asker,
): Effect.Effect<Answer, never, StageServices> =>
  Effect.gen(function* () {
    const status = yield* runPipeline(def, { command: 'status', target: target.abs })
    if (status.exit !== EXIT.done) return failed(status.error, status.exit)
    const record = status.gates.find((candidate) => candidate.id === gate)
    if (record === undefined) return failed(`no gate '${gate}' for this target`, EXIT.failed)
    if (record.decision !== 'pending')
      return {
        exit: EXIT.done,
        data: { gate: record, decision: record.decision, outcome: 'already decided' },
        summary: `${gate} already ${record.decision}`,
      }

    const summary = `${def.name} gate ${gate} (stage ${record.stage}) on ${target.rel}: review ${record.files.join(', ')}`
    const requested = yield* runPipeline(def, { command: 'request', target: target.abs, gate, note: summary })
    if (requested.exit !== EXIT.done) return failed(requested.error, requested.exit)
    const asked = requested.gates[0] as GateRecord
    const stage = (requested.data as { stage?: { inputHash: string; at: string } } | undefined)?.stage
    const words = [def.name, 'approve', target.rel, gate].map(shellQuote).join(' ')
    const ownerCommand = `automata-pipe ${words} --note "…"   (or reject)`
    const pending = (outcome: ReviewOutcome, line: string, extra: Record<string, unknown> = {}): Answer => ({
      exit: EXIT.done,
      data: { gate: asked, decision: 'pending', outcome, ownerCommand, ...extra },
      summary: line,
    })

    if (!asker.canAsk())
      return pending('asked', `${gate} put to the owner`, {
        instructions:
          `Show the person ${asked.files.join(', ')} and ask them to decide. Only the person decides: they run ` +
          `\`${ownerCommand}\` in their own terminal. Do not run it yourself.`,
      })

    const answer = yield* asker.ask(formMessage(summary, gate))
    if (answer.kind === 'undecided')
      return pending(answer.why, `${gate}: the owner did not decide (${answer.why})`)

    // The same code path as the person's own command: the runner records it, with `by: 'owner'`. `expect` makes it
    // land only on what the person was shown: a stage run again while the form was open reopens the gate, and the
    // runner then refuses the decision (exit 4, "ask again").
    const decided = yield* runPipeline(def, {
      command: answer.decision,
      target: target.abs,
      gate,
      note: answer.note,
      // Always compared: a request without a stage record or a time (which the runner never writes) matches nothing.
      expect: {
        requestedAt: asked.requestedAt ?? '',
        inputHash: stage?.inputHash ?? '',
        at: stage?.at ?? '',
      },
    })
    if (decided.exit !== EXIT.done) return failed(decided.error, decided.exit)
    const decidedGate = decided.gates[0] as GateRecord
    return {
      exit: EXIT.done,
      data: { gate: decidedGate, decision: decidedGate.decision, outcome: decidedGate.decision },
      summary: `${gate} ${decidedGate.decision} by the owner`,
    }
  })
