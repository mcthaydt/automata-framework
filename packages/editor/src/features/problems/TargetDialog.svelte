<!--
  The targets a broken reference may point at: the profile's choices as 44 px buttons in a
  scroll region; picking one closes the dialog and hands the choice back, which the view commits as one step.
-->
<script lang="ts">
import Button from '../../shared/kit/widgets/Button.svelte'
import Dialog from '../../shared/kit/widgets/Dialog.svelte'
import type { TargetChoice } from '../../shared/level-2d/profiles/profile'

interface Props {
  open: boolean
  /** What the reference belongs to (`door-1 in level-1`). */
  name: string
  choices: readonly TargetChoice[]
  onchoose: (choice: TargetChoice) => void
}

let { open = $bindable(), name, choices, onchoose }: Props = $props()
</script>

<Dialog bind:open title={`Choose a target for ${name}`}>
  {#if choices.length === 0}
    <p class="empty">Nothing in the project can be its target.</p>
  {:else}
    <ul class="choices" data-scroll-region>
      {#each choices as choice (choice.label)}
        <li>
          <button
            type="button"
            class="choice"
            onclick={() => {
              open = false
              onchoose(choice)
            }}>{choice.label}</button
          >
        </li>
      {/each}
    </ul>
  {/if}
  {#snippet actions({ close })}
    <Button data-autofocus onclick={close}>Cancel</Button>
  {/snippet}
</Dialog>

<style>
  .empty {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .choices {
    display: grid;
    gap: var(--space-1);
    max-height: 50vh;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
  }
  .choice {
    box-sizing: border-box;
    width: 100%;
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-raised);
    color: var(--color-text-primary);
    font: var(--text-body-13);
    text-align: start;
    cursor: pointer;
  }
</style>
