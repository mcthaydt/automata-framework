<!--
  @component
  The inventory: a row of item buttons (44 px), the one in hand marked. Pressing an item opens a small sheet with its name,
  its text and three actions: Hold (the primary, 48 px), Combine (then press the second item) and Close. The row scrolls
  inside the piece when it is long; nothing else scrolls. Escape and a pad's B close the sheet and focus goes back to the
  item. It is fed its words already looked up and asks the game through two callbacks.
-->
<script lang="ts">
import { tick } from 'svelte'
import { padSteer } from '../../shared/pad'
import { CLOSED, type InventoryState, pressItem, withItems } from './inventory'

interface Props {
  items: readonly { readonly id: string; readonly name: string; readonly text: string }[]
  held: string | undefined
  words: { readonly hold: string; readonly combine: string; readonly close: string; readonly empty: string }
  style: string
  onhold: (item: string | undefined) => void
  oncombine: (a: string, b: string) => void
}
const { items, held, words, style, onhold, oncombine }: Props = $props()

let ui: InventoryState = $state(CLOSED)
const ids = $derived(items.map((item) => item.id))
// A sheet for an item that has gone closes.
$effect(() => {
  ui = withItems(ui, ids)
})
const sheet = $derived(items.find((item) => item.id === ui.open))

let buttons: Record<string, HTMLButtonElement | undefined> = $state({})
let hold: HTMLButtonElement | undefined = $state()

/** Puts the focus back on an item once the sheet that was for it has gone. */
function refocus(id: string | undefined): void {
  void tick().then(() => {
    if (id !== undefined) buttons[id]?.focus({ preventScroll: true })
  })
}
/** Closes the sheet and puts the focus back on the item it was for. */
function close(): void {
  const back = ui.open
  ui = CLOSED
  refocus(back)
}
function press(id: string): void {
  const result = pressItem(ui, id)
  ui = result.state
  if (result.combine !== undefined) oncombine(result.combine[0], result.combine[1])
  // A sheet that just opened takes the focus on its primary action.
  if (result.state.open !== undefined && !result.state.combining && result.combine === undefined)
    void tick().then(() => hold?.focus({ preventScroll: true }))
}
function holdIt(): void {
  if (sheet === undefined) return
  const back = sheet.id
  onhold(held === back ? undefined : back)
  ui = CLOSED
  refocus(back)
}
function onkeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || ui.open === undefined) return
  event.preventDefault()
  close()
}
</script>

<svelte:window {onkeydown} />

<div class="hud-inventory" data-testid="hud-inventory" {style} use:padSteer={{ onback: () => ui.open !== undefined && close() }}>
  {#if items.length === 0}
    <p class="empty" data-testid="hud-inventory-empty">{words.empty}</p>
  {:else}
    <ul class="row">
      {#each items as item (item.id)}
        <li>
          <button
            type="button"
            class="af-control item"
            data-testid={`hud-item-${item.id}`}
            aria-pressed={held === item.id}
            bind:this={buttons[item.id]}
            onclick={() => press(item.id)}>{item.name}</button
          >
        </li>
      {/each}
    </ul>
  {/if}
  {#if sheet !== undefined}
    <div class="sheet" role="dialog" aria-label={sheet.name} data-testid="hud-item-sheet">
      {#if ui.combining}
        <p class="combining" data-testid="hud-item-combining">{words.combine}: {sheet.name} +</p>
      {:else}
        <p class="title">{sheet.name}</p>
        <p class="text">{sheet.text}</p>
      {/if}
      <div class="actions">
        <button
          type="button"
          class="af-control af-control--primary primary"
          data-kind="primary"
          data-testid="hud-item-hold"
          bind:this={hold}
          onclick={holdIt}>{words.hold}</button
        >
        <button
          type="button"
          class="af-control action"
          data-testid="hud-item-combine"
          disabled={ui.combining}
          onclick={() => (ui = { open: sheet.id, combining: true })}>{words.combine}</button
        >
        <button type="button" class="af-control action" data-testid="hud-item-close" onclick={close}>{words.close}</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .hud-inventory {
    box-sizing: border-box;
    display: grid;
    gap: 8px;
    max-height: 60%;
    padding: 8px;
    border: var(--af-edge-width, 2px) solid var(--af-edge, #a6aeba);
    border-radius: var(--af-radius, 6px);
    background: var(--af-surface, #181f2f);
    color: var(--af-ink, #f5f7fa);
    font: var(--af-text-body, 16px) / 1.4 var(--af-font, system-ui, sans-serif);
    pointer-events: auto;
  }
  .empty {
    margin: 0;
    overflow-wrap: anywhere;
  }
  /* The one place the row scrolls: inside the piece, sideways. */
  .row {
    display: flex;
    gap: 8px;
    margin: 0;
    padding: 0;
    overflow-x: auto;
    list-style: none;
  }
  .item {
    min-width: var(--af-target, 44px);
    min-height: var(--af-target, 44px);
    white-space: nowrap;
  }
  .item[aria-pressed='true'] {
    border-color: var(--af-accent, #ffcf05);
    color: var(--af-accent, #ffcf05);
  }
  .sheet {
    display: grid;
    gap: 8px;
    min-height: 0;
    overflow-y: auto;
  }
  .title {
    margin: 0;
    color: var(--af-accent, #ffcf05);
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  .text,
  .combining {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .primary {
    min-height: var(--af-target-primary, 48px);
  }
  .action {
    min-height: var(--af-target, 44px);
  }
</style>
