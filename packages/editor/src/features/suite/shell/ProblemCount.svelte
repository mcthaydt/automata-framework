<!--
  The header's count of problems, in a person's words ("No problems", "3 problems", "Checking…", "Not checked yet",
  "Couldn't check"; `problemWords`). It opens the list of what the checks found, each with Locate. `short` keeps the
  number and drops the word (the header is under 900 px), and the words stay its accessible name. `inline` is the list
  itself with no button, for the title menu on a phone, where the sheet is already the popup. A no-problem tone is quiet
  (`tool-faint`); only a warning, a failure or a check that could not run is `warn`.
-->
<script lang="ts">
import Icon from '../../../shared/kit/icons/Icon.svelte'
import type { CheckFinding } from '../../../shared/kit/ports/suite-ports'
import Popup from '../../../shared/kit/widgets/Popup.svelte'
import { type Pill, problemWords } from '../core/pills-model'

interface Props {
  pill: Pill
  short?: boolean
  inline?: boolean
  /** How the list opens: a popover under the count, or a sheet on a phone. */
  presentation?: 'popover' | 'sheet'
  onlocate: (finding: CheckFinding) => void
}

const { pill, short = false, inline = false, presentation = 'popover', onlocate }: Props = $props()

const words = $derived(problemWords(pill))
const worried = $derived(pill.tone === 'warn' || pill.tone === 'fail' || pill.tone === 'error')
let open = $state(false)
let trigger = $state<HTMLElement>()
</script>

{#snippet list()}
  <section class="list" aria-label={words}>
    {#if pill.items.length === 0}<p class="detail">{words}</p>{/if}
    <ul>
      {#each pill.items as item (item.id)}
        <li data-tone={item.tone}>
          <span class="name">{item.label}</span>
          {#if item.tone !== 'pass' && item.tone !== 'neutral'}<span class="detail">{item.tone}</span>{/if}
          {#if item.finding !== undefined}
            {@const finding = item.finding}
            <span class="finding">{finding.message}</span>
            <button type="button" class="locate" aria-label={`Locate ${item.label}`} onclick={() => onlocate(finding)}>
              Locate
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/snippet}

{#if inline}
  <p class="words" data-worried={worried}>{words}</p>
  {@render list()}
{:else}
  <button
    type="button"
    class="count"
    data-tone={pill.tone}
    data-worried={worried}
    aria-haspopup="dialog"
    aria-expanded={open}
    aria-label={words}
    bind:this={trigger}
    onclick={() => (open = !open)}
  >
    <Icon name={worried ? 'alert' : 'check'} size={16} />
    {#if short}
      {#if pill.problems > 0}<span class="number">{pill.problems}</span>{/if}
    {:else}
      {words}
    {/if}
  </button>
  <Popup bind:open anchor={trigger} {presentation} label={words}>{@render list()}</Popup>
{/if}

<style>
  .count {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: var(--size-hit);
    min-width: var(--size-hit);
    justify-content: center;
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--edge-sm);
    background: transparent;
    color: var(--tool-faint);
    font: var(--text-body-13);
    white-space: nowrap;
    cursor: pointer;
  }
  .count[data-worried='true'],
  .words[data-worried='true'] {
    color: var(--warn);
  }
  @media (hover: hover) {
    .count:hover {
      background: var(--surface);
    }
  }
  .count:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
  .number {
    font: var(--text-mono-12);
  }
  .words {
    margin: 0 0 var(--space-2);
    font: var(--text-body-13);
    color: var(--muted);
  }
  .list {
    box-sizing: border-box;
    min-width: 240px;
    max-height: 60vh;
    overflow: auto;
    padding: var(--space-3);
    color: var(--ink);
    font: var(--text-body-13);
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: var(--space-2);
  }
  li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-2);
  }
  .detail {
    margin: 0;
    color: var(--muted);
  }
  li[data-tone='fail'] .finding,
  li[data-tone='error'] .finding {
    color: var(--warn);
  }
  .locate {
    min-height: var(--size-hit);
    min-width: var(--size-hit);
    padding: 0 var(--space-3);
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    background: var(--raise);
    color: var(--ink);
    font: var(--text-body-13-medium);
    cursor: pointer;
  }
</style>
