<!--
  @component
  The first run's language screen: every language the game ships in its own script, the one the device suggested
  focused, one press to pick it and go on. Close and Escape go on with the suggested one. It is a Modal, so the page
  behind is inert, Tab wraps, and the pad's Back closes it as Escape does. Each button is 48 px high and sets its own
  `lang`, so a screen reader says it in that language.
-->
<script lang="ts">
import Modal from '../../shared/ui/dialog/Modal.svelte'
import type { LiveScreensCopy } from '../screens/screens-copy.svelte'
import { endonymOf } from '../screens/settings/language-section'

interface Props {
  /** The game's languages, in its own order. */
  locales: readonly string[]
  /** The language the device suggested: its button has focus. */
  detected: string
  /** The screens' words in the player's language; the title follows a change in place. */
  copy: LiveScreensCopy
  onpick: (tag: string) => void
  onclose: () => void
}

const { locales, detected, copy, onpick, onclose }: Props = $props()
</script>

<Modal title={copy.current.firstRun.language.title} closeLabel={copy.current.firstRun.language.close} {onclose} testId="first-language">
  <ul class="af-first-language">
    {#each locales as tag (tag)}
      <li>
        <button
          type="button"
          class="af-control af-first-language__button"
          data-kind="primary"
          data-testid={`first-language-${tag}`}
          data-initial-focus={tag === detected ? '' : undefined}
          lang={tag}
          onclick={() => onpick(tag)}>{endonymOf(tag)}</button
        >
      </li>
    {/each}
  </ul>
</Modal>

<style>
  /* Two across where the dialog is wide enough, so all six fit a short landscape screen without scrolling. */
  .af-first-language {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 9.5rem), 1fr));
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .af-first-language__button {
    width: 100%;
    justify-content: center;
  }
</style>
