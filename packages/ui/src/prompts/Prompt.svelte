<!--
  @component
  A device prompt (M4 spec §4.6): the label of an action's input on the device in the player's hand, a key, a pad
  button or the touch label, or "Unbound". It follows its props in place, so a rebind or a device switch never
  remounts it, and it is never in the focus order. `data-prompt` is the kind.
-->
<script lang="ts">
import {
  type PromptBinding,
  type PromptCopy,
  type PromptDevice,
  type PromptGlyphs,
  promptView,
} from './prompt-label'

interface Props {
  binding: PromptBinding
  device: PromptDevice
  glyphs: PromptGlyphs
  copy: PromptCopy
  /** The keyboard's layout map (`readKeyboardLayout`), when the browser has one. */
  layout?: ReadonlyMap<string, string> | undefined
}

const { binding, device, glyphs, copy, layout }: Props = $props()

const view = $derived(promptView(binding, device, glyphs, copy, layout))
</script>

<span class="af-prompt" data-prompt={view.kind}>{view.label}</span>

<style>
  .af-prompt {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2em;
    padding: 1px 8px;
    border: var(--af-edge-width) solid var(--af-edge);
    border-radius: 6px;
    background: var(--af-panel);
    color: var(--af-ink);
    font: 700 var(--af-text-small) / 1.3 var(--af-font);
    overflow-wrap: anywhere;
  }

  .af-prompt[data-prompt="unbound"] {
    border-style: dashed;
    font-weight: 600;
  }
</style>
