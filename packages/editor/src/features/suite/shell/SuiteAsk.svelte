<!--
  Ask, wired to the open editor: the Ask session's state on the dialog, and its rule that an edit, undo or redo in the
  document drops a proposal in flight or on show. An accepted proposal is written through the suite's write path, so
  the suite follows it (`onwritten`) or says why it was refused (`onrefused`). Split out of `Suite.svelte` (12.7).
-->
<script lang="ts">
import type { WriteOutcome } from '../../../shared/editor-list/write-path'
import type { SuiteUndo } from '../../../shared/kit/ports/suite-editor'
import type { AskSession, AskState } from '../core/ask-session'
import AskDialog from './AskDialog.svelte'

interface Props {
  session: AskSession
  /** The files Ask may change, as the dialog lists them. */
  scope: readonly string[]
  /** The open change set's tokens; `undefined` hides the meter. */
  tokens: { readonly used: number; readonly cap: number } | undefined
  /** The open editor's history: any step in it drops the proposal. */
  undo: SuiteUndo | undefined
  open: boolean
  /** A reply has spent tokens through the change set, so the meter should be read again. */
  onspent: () => void
  onwritten: (outcome: WriteOutcome & { written: true }) => void
  onrefused: (outcome: WriteOutcome) => void
}

let { session, scope, tokens, undo, open = $bindable(), onspent, onwritten, onrefused }: Props = $props()

let view = $state<AskState>({ kind: 'idle' })

$effect(() => {
  const current = session
  view = current.state()
  const stopState = current.subscribe(() => {
    view = current.state()
    if (view.kind === 'shown' || view.kind === 'over-budget') onspent()
  })
  const stopHistory = undo?.subscribe(() => current.drop())
  return () => {
    stopState()
    stopHistory?.()
  }
})

async function accept(): Promise<void> {
  const outcome = await session.accept()
  if (outcome === undefined) return
  if ('written' in outcome) {
    open = false
    onwritten(outcome)
  } else onrefused(outcome)
}
</script>

<AskDialog
  {open}
  {view}
  {scope}
  {tokens}
  onask={(prompt) => void session.ask(prompt)}
  onaccept={() => void accept()}
  onreject={() => session.reject()}
  onrewrite={() => void session.rewrite()}
  onclose={() => (open = false)}
/>
