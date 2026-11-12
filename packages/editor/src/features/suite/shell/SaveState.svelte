<!--
  Whether the work is kept: a tick and "Saved", "Saving…", or what went wrong in words. A quiet status, never a button, so
  it is read out when it changes (`role="status"`) without taking the focus. The suite writes the game's own files, so
  "Saved" says all a person needs; the folder is named once, on Home.
-->
<script lang="ts">
import Icon from '../../../shared/kit/icons/Icon.svelte'

interface Props {
  save: 'saved' | 'saving' | { readonly failed: string }
}

const { save }: Props = $props()
const failed = $derived(typeof save === 'object' ? save.failed : undefined)
</script>

<span class="save" role="status" data-state={failed !== undefined ? 'failed' : save}>
  {#if failed !== undefined}
    <Icon name="alert" size={16} />Not saved: {failed}
  {:else if save === 'saving'}
    Saving…
  {:else}
    <Icon name="check" size={16} />Saved
  {/if}
</span>

<style>
  .save {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 6px;
    color: var(--tool-faint);
    font: var(--text-body-13);
    white-space: nowrap;
  }
  .save[data-state='failed'] {
    color: var(--warn);
  }
</style>
