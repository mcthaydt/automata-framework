<!--
  The save conflict: the project was changed somewhere else after it was opened, so the step could not be saved. In
  plain words: Use mine saves the level over the other version; Use theirs takes the other version and drops the step
  that did not save. Both are the person's to choose, so the dialog stays until one is (no Cancel, no Escape), and
  nothing was overwritten before they do.
-->
<script lang="ts">
import Button from '../../../shared/kit/widgets/Button.svelte'
import Dialog from '../../../shared/kit/widgets/Dialog.svelte'
import type { Levels2dSession } from './levels-2d-session'

const { session }: { session: Levels2dSession } = $props()

// svelte-ignore state_referenced_locally
const conflict = session.conflict
// svelte-ignore state_referenced_locally
const current = session.current
let busy = $state(false)

/** The project's own name, or the file's when it has none. */
const name = $derived.by(() => {
  const state = $current
  const titled = state.kind === 'open' ? state.profile.summary?.(state.history.state)?.title : undefined
  return titled ?? session.path.split('/').pop() ?? session.path
})

async function choose(run: () => Promise<void>): Promise<void> {
  busy = true
  try {
    await run()
  } finally {
    busy = false
  }
}
</script>

{#if $conflict}
  <Dialog open={true} title={`${name} was changed somewhere else`} dismissible={false}>
    <p>
      It was saved from another place while you worked on it here. Nothing has been overwritten. Use mine saves your
      changes over the other version. Use theirs throws your changes away.
    </p>
    {#snippet actions()}
      <Button variant="danger" disabled={busy} onclick={() => choose(() => session.takeTheirs())}>Use theirs</Button>
      <Button variant="primary" data-autofocus disabled={busy} onclick={() => choose(() => session.keepMine())}>
        Use mine
      </Button>
    {/snippet}
  </Dialog>
{/if}

<style>
  p {
    margin: 0;
    color: var(--muted);
  }
</style>
