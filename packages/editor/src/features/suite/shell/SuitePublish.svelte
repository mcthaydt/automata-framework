<!--
  The suite's two outward dialogs, Publish and Export/Import, and what they read before they open. Publish reads the
  open change set and its drafted description, then shows the dialog; Export and Import open on Home's question row.
  The suite page only says which one is asked for (split from `Suite.svelte` by responsibility in 12.5).
-->
<script lang="ts">
import type { ReviewChangeSet } from '../core/review-model'
import InterchangeDialog from './InterchangeDialog.svelte'
import ShipDialog from './ShipDialog.svelte'
import type { SuiteSession } from './suite-session'

interface Props {
  session: SuiteSession
  /** The locked values of a file, for an import's plan (only the open editor's file has any). */
  locked: (path: string) => readonly string[]
  /** Set true to publish; the dialog sets it false when it closes. */
  publishing: boolean
  /** Which interchange dialog is open, if any; cleared when it closes. */
  interchange: 'export' | 'import' | undefined
}

let { session, locked, publishing = $bindable(), interchange = $bindable() }: Props = $props()

let review = $state<ReviewChangeSet>()
let draft = $state<{ readonly title: string; readonly body: string }>()
// The dialog opens once both are read, so it never shows an empty description first.
let ready = $state(false)

$effect(() => {
  if (!publishing) {
    ready = false
    return
  }
  void Promise.all([session.review(), session.draft()]).then(([[open], drafted]) => {
    review = open
    draft = drafted
    ready = true
  })
})
</script>

<ShipDialog
  open={publishing && ready}
  {review}
  {draft}
  onship={(next) => session.ship(next)}
  onclose={() => (publishing = false)}
/>
{#if interchange !== undefined}
  <InterchangeDialog
    open
    mode={interchange}
    onexport={(format) => session.exportGame(format)}
    onplan={(text) => session.planImport(text, locked)}
    onapply={(plan) => session.applyImport(plan)}
    onclose={() => (interchange = undefined)}
  />
{/if}
