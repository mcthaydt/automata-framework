<!--
  @component
  The Controls tab's section, one section per device the player can use, the one in their hand first and marked. Keyboard and
  Controller list each action with one rebind button showing that device's prompt; the Controller appears once a pad
  has connected (`devices`). Touch, when shown, says what the on-screen buttons do; they are the game's, so there is
  nothing to rebind. A status line says each step of a rebind (`state`), and Reset puts every binding back.
  Every row is a 44 px target; long labels wrap, and the targets never shrink.
-->
<script lang="ts">
import Button from '../../../shared/ui/controls/Button.svelte'
import Prompt from '../../../shared/ui/prompts/Prompt.svelte'
import type { PromptCopy, PromptDevice, PromptGlyphs } from '../../../shared/ui/prompts/prompt-label'
import {
  type ControlsCopy,
  type ControlsRow,
  type ControlsState,
  controlsMessage,
  type RebindDevice,
} from './controls-section'

interface Props {
  rows: readonly ControlsRow[]
  /** The devices the player can rebind: the keyboard, and the controller once a pad has connected. */
  devices: readonly RebindDevice[]
  /** Whether to say what the on-screen buttons do: the game has them and the player can touch. */
  touch?: boolean | undefined
  /** The device in the player's hand: its section comes first, marked. */
  inUse: PromptDevice
  /** The labels of the pad in use, for the controller section. */
  glyphs: PromptGlyphs
  promptCopy: PromptCopy
  /** The keyboard's layout map (`readKeyboardLayout`), when the browser has one. */
  layout?: ReadonlyMap<string, string> | undefined
  copy: ControlsCopy
  state: ControlsState
  onrebind: (action: string, device: RebindDevice) => void
  onreset: () => void
}

// `state` is the prop's name; inside, it is `current`, as `$state` is the rune's.
const {
  rows,
  devices,
  touch = false,
  inUse,
  glyphs,
  promptCopy,
  layout,
  copy,
  state: current,
  onrebind,
  onreset,
}: Props = $props()

const labelOf = (action: string): string => rows.find((row) => row.id === action)?.label ?? action
const message = $derived(controlsMessage(current, copy, labelOf))
// The device sections, the one in use first, then keyboard, controller and touch.
const shown = $derived.by((): PromptDevice[] => {
  const all: PromptDevice[] = [...devices, ...(touch ? (['touch'] as const) : [])]
  return all.includes(inUse) ? [inUse, ...all.filter((device) => device !== inUse)] : all
})
const touchRows = $derived(rows.filter((row) => row.binding.touch))
const waitingOn = (action: string, device: RebindDevice): boolean =>
  current.kind === 'capturing' && current.action === action && current.device === device

// The status line appears above the rows as a capture starts, and can push the button that started it out of the
// list's view on a short screen: keep that button, the one the player is reading, in view.
let root = $state<HTMLElement | undefined>(undefined)
$effect(() => {
  if (current.kind !== 'capturing') return
  root?.querySelector<HTMLElement>('[data-capturing]')?.scrollIntoView?.({ block: 'nearest' })
})
</script>

<section
  bind:this={root}
  class="af-controls"
  data-settings-section="controls"
  data-state={current.kind}
  aria-label={copy.title}
>
  <p class="af-controls__message" role="status" data-controls-message>{message}</p>
  {#each shown as device (device)}
    <section class="af-controls__device" data-controls-device={device} data-in-use={device === inUse ? '' : undefined}>
      <h3 class="af-settings__heading">
        {copy[device]}
        {#if device === inUse}<span class="af-controls__in-use">{copy.inUse}</span>{/if}
      </h3>
      <ul class="af-controls__rows">
        {#if device === 'touch'}
          {#each touchRows as row (row.id)}
            <li class="af-controls__row" data-control-row={row.id}>
              <span class="af-controls__label">{row.label}</span>
              <span class="af-controls__prompt">
                <Prompt binding={row.binding} device="touch" {glyphs} copy={promptCopy} {layout} />
              </span>
            </li>
          {/each}
        {:else}
          {#each rows as row (row.id)}
            <li class="af-controls__row" data-control-row={row.id}>
              <span class="af-controls__label">{row.label}</span>
              <button
                type="button"
                class="af-control af-controls__bind"
                data-rebind={device}
                data-capturing={waitingOn(row.id, device) ? '' : undefined}
                aria-label={copy.rebind(row.label, copy[device])}
                onclick={() => onrebind(row.id, device)}
              >
                {#if waitingOn(row.id, device)}
                  {copy.press}
                {:else}
                  <Prompt binding={row.binding} {device} {glyphs} copy={promptCopy} {layout} />
                {/if}
              </button>
            </li>
          {/each}
        {/if}
      </ul>
    </section>
  {/each}
  <div class="af-controls__reset">
    <Button kind="ghost" testId="controls-reset" onclick={onreset}>{copy.reset}</Button>
  </div>
</section>

<style>
  .af-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .af-controls__device {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .af-controls__in-use {
    margin-inline-start: 8px;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--af-accent);
    color: var(--af-on-accent);
    font: 600 var(--af-text-small) / 1.4 var(--af-font);
  }

  .af-controls__message:empty {
    display: none;
  }

  .af-controls__rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .af-controls__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    min-width: 0;
    min-height: var(--af-target);
  }

  /* The action beside its input: a label column, not the row's whole width. */
  .af-controls__label {
    flex: 0 1 12em;
    overflow-wrap: anywhere;
  }

  /* One button a row, kept whole inside the scroll list: where a font sets "Press…" wider (WebKit on macOS at TV
     scale, 780 x 270), it wraps its words rather than overflow. */
  .af-controls__bind {
    flex: none;
    min-width: min(calc(var(--af-target) * 2), 100%);
    max-width: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
  }
</style>
