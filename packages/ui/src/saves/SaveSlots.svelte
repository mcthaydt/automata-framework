<!--
  @component
  The save slots (M5 spec §6, §7): a row for each slot, and the few things a player does with one. Rows are chosen,
  not acted on: the chosen row (the newest slot that can be continued, to begin with) decides the actions in the bar
  under the list. Continue for a slot that can be opened, New game for an empty one, and Delete… for any that holds
  something. A save that cannot be opened, or that a newer build made, offers nothing but Delete…, so writing over
  it takes two steps. Delete… asks first, in a dialog whose safe button has focus; the question says so when a newer
  build made the save.
  The rows are in a ScrollList, a declared scroll region, so on a short screen they scroll and the bar stays. A label
  and a time wrap to two lines and are then cut, with the whole text left in the row for assistive technology.
  Nothing here reads a store: the runtime's slots arrive as `view` and the player's choices leave as callbacks.
-->
<script lang="ts">
import { tick } from 'svelte'
import Dialog from '../dialog/Dialog.svelte'
import ActionBar from '../layout/ActionBar.svelte'
import type { BarAction } from '../layout/action-bar'
import ScrollList from '../layout/ScrollList.svelte'
import {
  defaultSlot,
  type SaveSlotsCopy,
  type SaveSlotsView,
  type SaveSlotView,
  slotActionsOf,
} from './save-slots'

interface Props {
  view: SaveSlotsView
  copy: SaveSlotsCopy
  /** How a save's time reads: the caller's locale formatting (PRODUCT.L). */
  formatTime: (savedAt: number) => string
  /** Continue this slot. */
  onload: (slot: number) => void
  /** Start a new game in this empty slot. */
  onnew: (slot: number) => void
  /** Delete this slot; asked and confirmed already. */
  ondelete: (slot: number) => void
  testId?: string | undefined
}

const { view, copy, formatTime, onload, onnew, ondelete, testId = 'save-slots' }: Props = $props()

const slots = $derived(view.state === 'slots' ? view.slots : [])
/** The player's choice, until its slot goes; then the default again. */
let choice = $state<number | undefined>(undefined)
const picked = $derived(
  slots.find((slot) => slot.slot === choice) ?? slots.find((slot) => slot.slot === defaultSlot(slots)),
)

/** The slot the delete question is about; the question closes if the slot goes. */
let asking = $state<number | undefined>(undefined)
const asked = $derived(slots.find((slot) => slot.slot === asking))

const nameOf = (slot: SaveSlotView): string =>
  (slot.kind === 'ready' || slot.kind === 'other-content' ? slot.label : undefined) ?? copy.slot(slot.slot)

const busy = $derived(picked?.activity === 'writing')

const barActions = $derived.by((): BarAction[] => {
  if (picked === undefined) return []
  const can = slotActionsOf(picked)
  const slot = picked.slot
  const list: BarAction[] = []
  if (can.load)
    list.push({
      id: 'load',
      label: copy.load,
      kind: 'primary',
      onSelect: () => onload(slot),
      disabled: busy,
      testId: `${testId}-load`,
    })
  if (can.newGame)
    list.push({
      id: 'new',
      label: copy.newGame,
      kind: 'primary',
      onSelect: () => onnew(slot),
      disabled: busy,
      testId: `${testId}-new`,
    })
  if (can.remove)
    list.push({
      id: 'delete',
      label: copy.delete,
      kind: 'secondary',
      onSelect: () => {
        asking = slot
      },
      disabled: busy,
      testId: `${testId}-delete`,
    })
  return list
})

async function confirmDelete(slot: SaveSlotView): Promise<void> {
  asking = undefined
  ondelete(slot.slot)
  // The dialog gives focus back to Delete…, which a deleted slot may no longer offer: land on the slot's row instead.
  await tick()
  document.querySelector<HTMLElement>(`[data-save-slot="${slot.slot}"]`)?.focus()
}
</script>

<section class="af-save-slots" data-save-slots data-state={view.state} data-testid={testId} aria-label={copy.title}>
  {#if view.state === 'loading'}
    <p class="af-save-slots__message" data-save-slots-message role="status" aria-live="polite">{copy.loading}</p>
  {:else}
    <div class="af-save-slots__list">
      <ScrollList minRows={1} rowCount={slots.length} rowGap="4px" label={copy.title} moreLabel={copy.more}>
        <div class="af-save-slots__rows" role="radiogroup" aria-label={copy.title}>
          {#each slots as slot (slot.slot)}
            <button
              type="button"
              role="radio"
              class="af-save-slot"
              aria-checked={picked?.slot === slot.slot}
              data-row
              data-save-slot={slot.slot}
              data-kind={slot.kind}
              data-activity={slot.activity}
              onclick={() => {
                choice = slot.slot
              }}
            >
              <span class="af-save-slot__name">{nameOf(slot)}</span>
              <span class="af-save-slot__detail">
                {#if slot.activity === 'writing'}
                  {copy.writing}
                {:else if slot.activity === 'failed'}
                  {copy.failed}
                {:else if slot.kind === 'empty'}
                  {copy.empty}
                {:else if slot.kind === 'unreadable'}
                  {copy.unreadable}
                {:else if slot.kind === 'newer'}
                  {copy.newer}
                {:else if slot.kind === 'other-content'}
                  {formatTime(slot.savedAt)} · {copy.otherContent}
                {:else}
                  {formatTime(slot.savedAt)}
                {/if}
              </span>
            </button>
          {/each}
        </div>
      </ScrollList>
    </div>
    {#if barActions.length > 0}
      <ActionBar actions={barActions} testId={`${testId}-actions`} />
    {/if}
  {/if}
</section>

{#if asked !== undefined}
  <Dialog
    title={copy.deleteTitle}
    onclose={() => {
      asking = undefined
    }}
  >
    <p class="af-save-slots__question">
      {asked.kind === 'newer' ? copy.deleteNewerBody : copy.deleteBody(nameOf(asked))}
    </p>
    {#snippet actions()}
      <button
        type="button"
        class="af-control af-control--primary"
        data-kind="primary"
        data-initial-focus
        data-testid={`${testId}-cancel`}
        onclick={() => {
          asking = undefined
        }}>{copy.cancel}</button
      >
      <button type="button" class="af-control" data-testid={`${testId}-confirm`} onclick={() => void confirmDelete(asked)}
        >{copy.deleteConfirm}</button
      >
    {/snippet}
  </Dialog>
{/if}

<style>
  /* The list fills what its parent gives it: the rows take what is left after the bar and scroll inside it. */
  .af-save-slots {
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-sizing: border-box;
    height: 100%;
    min-height: 0;
    color: var(--af-ink);
    font: var(--af-text-body) / 1.3 var(--af-font);
  }

  /* A 1fr grid row, as ScrollList asks of its parent. */
  .af-save-slots__list {
    display: grid;
    flex: 1 1 auto;
    grid-template-rows: 1fr;
    min-height: 0;
  }

  .af-save-slots__rows {
    display: grid;
    gap: 4px;
  }

  .af-save-slots__message,
  .af-save-slots__question {
    margin: 0;
  }

  /* A 48 px row (the primary target, at the scale): the name above, what it holds below, each at most two lines. The chosen row is marked by an outline
     and by aria-checked, never by colour alone. */
  .af-save-slot {
    display: grid;
    gap: 2px;
    box-sizing: border-box;
    min-height: var(--af-target-primary);
    padding: 4px 12px;
    border: var(--af-edge-width) solid var(--af-edge);
    border-radius: 4px;
    background: var(--af-panel);
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }

  .af-save-slot[aria-checked="true"] {
    outline: calc(var(--af-edge-width) * 2) solid var(--af-accent);
    outline-offset: -2px;
  }

  .af-save-slot__name,
  .af-save-slot__detail {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    overflow-wrap: anywhere;
  }

  .af-save-slot__name {
    font-weight: 700;
  }

  .af-save-slot__detail {
    font-size: var(--af-text-small);
  }

  .af-save-slot[data-activity="failed"] .af-save-slot__detail {
    color: var(--af-danger-edge);
  }
</style>
