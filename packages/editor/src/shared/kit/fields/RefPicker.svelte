<!--
  The reference picker: first the levels that hold something the
  field may point at, each with its count, then that level's choices (the level itself first when it may be one). Back
  returns to the levels; picking closes the dialog and hands the value back, which the field commits as one step.
  Choices are 44 px buttons in a scroll region.
-->
<script lang="ts">
import type { RefValue } from '@automata/content/level-2d'
import Button from '../widgets/Button.svelte'
import Dialog from '../widgets/Dialog.svelte'
import type { RefTargetGroup } from './field-row'

interface Props {
  open: boolean
  /** The field's label, as the title names it. */
  name: string
  targets: readonly RefTargetGroup[]
  onchoose: (value: RefValue) => void
}

let { open = $bindable(), name, targets, onchoose }: Props = $props()

let chosen = $state<string | undefined>()
const level = $derived(targets.find((each) => each.id === chosen))

// Every opening starts at the levels.
$effect(() => {
  if (open) chosen = undefined
})

const count = (each: RefTargetGroup): string =>
  each.choices.length === 1 ? '1 target' : `${each.choices.length} targets`
</script>

<Dialog bind:open title={`Choose a target for ${name}`}>
  {#if targets.length === 0}
    <p class="empty">Nothing in this game can be its target.</p>
  {:else if level === undefined}
    <ul class="choices" data-scroll-region aria-label="Levels">
      {#each targets as each (each.id)}
        <li>
          <button type="button" class="choice" onclick={() => (chosen = each.id)}>
            <span>{each.name}</span>
            <span class="count">{count(each)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <div class="head">
      <Button onclick={() => (chosen = undefined)}>Back</Button>
      <h3>{level.name}</h3>
    </div>
    <ul class="choices" data-scroll-region aria-label={`Targets in ${level.name}`}>
      {#each level.choices as choice (choice.label)}
        <li>
          <button
            type="button"
            class="choice"
            onclick={() => {
              open = false
              onchoose(choice.value)
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
    color: var(--muted);
    font: var(--text-body-13);
  }
  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }
  h3 {
    margin: 0;
    color: var(--ink);
    font: var(--text-title-15);
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
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    box-sizing: border-box;
    width: 100%;
    min-height: var(--size-hit);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--edge-sm);
    background: var(--paper);
    color: var(--ink);
    font: var(--text-body-13);
    text-align: start;
    cursor: pointer;
  }
  .count {
    color: var(--muted);
  }
</style>
