<!--
  @component
  The Controls section of Settings (M4 spec §4.5, §7): a row per game action, its label and a rebind button for each
  device the player can use, the button showing that device's prompt. Controller buttons appear once a pad has
  connected (`devices`). A status line says each step of a rebind (`state`), the touch mode is offered only when the
  game binds both buttons and swipes, and Reset puts every binding back. Every row is a 44 px target; long labels
  wrap, and the targets never shrink.
-->
<script lang="ts">
import Button from '../controls/Button.svelte'
import OptionGroup from '../layout/OptionGroup.svelte'
import Prompt from '../prompts/Prompt.svelte'
import type { PromptCopy, PromptGlyphs } from '../prompts/prompt-label'
import {
  type ControlsCopy,
  type ControlsRow,
  type ControlsState,
  type ControlsTouchMode,
  controlsMessage,
  type RebindDevice,
} from './controls-section'

interface Props {
  rows: readonly ControlsRow[]
  devices: readonly RebindDevice[]
  /** The labels of the pad in use, for the controller column. */
  glyphs: PromptGlyphs
  promptCopy: PromptCopy
  /** The keyboard's layout map (`readKeyboardLayout`), when the browser has one. */
  layout?: ReadonlyMap<string, string> | undefined
  copy: ControlsCopy
  state: ControlsState
  /** The touch modes the game offers and the player's; a choice only with both. */
  touch?:
    | {
        readonly modes: readonly ControlsTouchMode[]
        readonly value: ControlsTouchMode
        readonly onchange: (mode: ControlsTouchMode) => void
      }
    | undefined
  onrebind: (action: string, device: RebindDevice) => void
  onreset: () => void
}

// `state` is the prop's name; inside, it is `current`, as `$state` is the rune's.
const {
  rows,
  devices,
  glyphs,
  promptCopy,
  layout,
  copy,
  state: current,
  touch,
  onrebind,
  onreset,
}: Props = $props()

const labelOf = (action: string): string => rows.find((row) => row.id === action)?.label ?? action
const message = $derived(controlsMessage(current, copy, labelOf))
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

<section bind:this={root} class="af-controls" data-settings-section="controls" data-state={current.kind}>
  <h3 class="af-settings__heading">{copy.title}</h3>
  <p class="af-controls__message" role="status" data-controls-message>{message}</p>
  <ul class="af-controls__rows">
    {#each rows as row (row.id)}
      <li class="af-controls__row" data-control-row={row.id}>
        <span class="af-controls__label">{row.label}</span>
        <span class="af-controls__binds">
          {#each devices as device (device)}
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
          {/each}
        </span>
      </li>
    {/each}
  </ul>
  {#if touch !== undefined && touch.modes.length > 1}
    <div data-controls-touch-mode>
      <OptionGroup
        label={copy.touchMode}
        options={touch.modes.map((mode) => ({ value: mode, label: copy.touchModes[mode] }))}
        value={touch.value}
        onchange={(mode) => touch.onchange(mode as ControlsTouchMode)}
      />
    </div>
  {/if}
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
    justify-content: space-between;
    gap: 6px 12px;
    min-width: 0;
    min-height: var(--af-target);
  }

  .af-controls__label {
    flex: 1 1 8em;
    overflow-wrap: anywhere;
  }

  /* The buttons wrap inside the row, never past it: where a font sets "Press…" wider (WebKit on macOS at TV scale,
     780 x 270), a button moves to the next line or wraps its words, and stays whole inside the scroll list. */
  .af-controls__binds {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;
    max-width: 100%;
  }

  .af-controls__bind {
    min-width: min(calc(var(--af-target) * 2), 100%);
    max-width: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
  }
</style>
