<!--
  The refusal of a delete or a field change that would remove or break values (plan ED2D.5c decisions 2 and 8; 2D
  editor spec §8 flow 5, G-f): it lists each use by its instance and level, with the model's message, and offers the
  change anyway, which the caller applies as one undo step. Cancel has focus first, so a stray Enter changes nothing.
-->
<script lang="ts">
import Button from '../../shared/kit/widgets/Button.svelte'
import Dialog from '../../shared/kit/widgets/Dialog.svelte'
import type { DefinitionUse } from '../../shared/level-2d/model/commands/def-lookup'
import { useLabel } from './entities-model'

interface Props {
  open: boolean
  title: string
  /** `Delete anyway` or `Change anyway`. */
  action: string
  uses: readonly DefinitionUse[]
  onconfirm: () => void
}

let { open = $bindable(), title, action, uses, onconfirm }: Props = $props()
</script>

<Dialog bind:open {title}>
  <p>{uses.length === 1 ? 'This is used once:' : `This is used ${uses.length} times:`}</p>
  <ul class="uses" data-scroll-region>
    {#each uses as use (use.path)}
      <li title={use.path}>
        <span class="where">{useLabel(use.path)}</span>
        <span class="why">{use.message}</span>
      </li>
    {/each}
  </ul>
  <p>{action === 'Delete anyway' ? 'Deleting it removes these too.' : 'Changing it resets these values.'} Undo puts them back.</p>
  {#snippet actions({ close })}
    <Button data-autofocus onclick={close}>Cancel</Button>
    <Button
      variant="danger"
      onclick={() => {
        close()
        onconfirm()
      }}
    >
      {action}
    </Button>
  {/snippet}
</Dialog>

<style>
  p {
    margin: 0 0 var(--space-2);
  }
  .uses {
    display: grid;
    gap: var(--space-1);
    max-height: 40vh;
    margin: 0 0 var(--space-3);
    padding: 0;
    overflow: auto;
    list-style: none;
  }
  li {
    display: grid;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
  }
  .where {
    font: var(--text-body-13-medium);
  }
  .why {
    color: var(--color-text-dim);
    font: var(--text-mono-11);
  }
</style>
