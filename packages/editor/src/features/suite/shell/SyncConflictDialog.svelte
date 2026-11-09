<!--
  A file changed here and on GitHub, and the sync left it as it was. One file at a time, in plain words
  (`sync-conflict-words.ts`): what happened and what each button does. The choice that loses nothing has the focus
  (Keep both for a file changed on both sides); Keep GitHub's, which drops what was done here, is the danger one.
  "Not now" and Escape change nothing; the file keeps waiting and the top bar says so. The choices are disabled while
  one runs. The page decides when this opens (never in the middle of a word being typed) and what a choice does.
-->
<script lang="ts">
import type { Choice, MergeAsk } from '../../../shared/kit/sync/git-engine'
import Button from '../../../shared/kit/widgets/Button.svelte'
import Dialog from '../../../shared/kit/widgets/Dialog.svelte'
import { conflictWords } from './sync-conflict-words'

interface Props {
  /** The files that wait. The first is asked about; none closes the dialog. */
  conflicts: readonly MergeAsk[]
  /** A choice is being carried out. */
  busy: boolean
  /** The last choice could not be carried out (no internet); nothing changed. */
  failed: boolean
  onchoose: (path: string, choice: Choice) => void
  onlater: () => void
}

const { conflicts, busy, failed, onchoose, onlater }: Props = $props()

const ask = $derived(conflicts[0])
const words = $derived(ask === undefined ? undefined : conflictWords(ask))
</script>

{#if ask && words}
  <Dialog
    open={true}
    title={words.title}
    onclose={onlater}
  >
    <div class="body">
      {#if conflicts.length > 1}<p class="count">{`1 of ${String(conflicts.length)} files`}</p>{/if}
      <p>{words.why} Nothing has been lost.</p>
      <ul>
        {#each words.options as option (option.choice)}
          <li><strong>{option.label}.</strong> {option.detail}</li>
        {/each}
      </ul>
      {#if failed}
        <p class="warn" role="alert">Couldn’t reach GitHub. Nothing changed. Try again.</p>
      {/if}
    </div>
    {#snippet actions()}
      <Button onclick={onlater}>Not now</Button>
      {#each words.options as option (option.choice)}
        <Button
          variant={option.choice === words.primary ? 'primary' : option.choice === 'theirs' ? 'danger' : 'plain'}
          data-autofocus={option.choice === words.primary ? '' : undefined}
          disabled={busy}
          onclick={() => onchoose(ask.path, option.choice)}
        >
          {option.label}
        </Button>
      {/each}
    {/snippet}
  </Dialog>
{/if}

<style>
  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  p,
  ul {
    margin: 0;
    color: var(--muted);
  }
  ul {
    padding-left: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  strong {
    color: var(--ink);
  }
  .count {
    font: var(--text-body-13);
  }
  .warn {
    color: var(--warn);
  }
</style>
