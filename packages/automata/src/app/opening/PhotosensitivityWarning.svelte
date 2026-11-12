<!--
  @component
  The first run's flashing-lights warning: what the game does, the switches that turn it down (the game's own effect
  settings, each applied the moment it is flipped), what the device says about reduced motion, and a primary Continue.
  It is a Modal, so the page behind is inert, Tab wraps, and Close, Escape and the pad's Back all go on: the warning is
  never a gate the player cannot leave. Continue is focused and 48 px high; the body scrolls inside its own region
  where a short screen cannot show it whole.
-->
<script lang="ts">
import Toggle from '../../shared/ui/controls/Toggle.svelte'
import Modal from '../../shared/ui/dialog/Modal.svelte'
import type { LiveScreensCopy, LocaleReader } from '../screens/screens-copy.svelte'
import type { WarningSwitch } from './photosensitivity'

interface Props {
  /** The screens' words in the player's language; they follow a change in place. */
  copy: LiveScreensCopy
  /** The player's language, for a switch whose label is a function of it. */
  locale: LocaleReader
  /** The game's own effect settings the warning offers. */
  switches: readonly WarningSwitch[]
  /** `prefers-reduced-motion`, as the browser reports it. */
  reducedMotion: boolean
  /** Continue, Close and Escape all end the warning. */
  ondone: () => void
}

const { copy, locale, switches, reducedMotion, ondone }: Props = $props()

const words = $derived(copy.current.firstRun.warning)

// The language the labels are said in: it changes if the player switches language while the warning is open. The
// locale is fixed for the mount, so its first value is the one to start from.
// svelte-ignore state_referenced_locally
let language = $state(locale.current)
$effect(() => locale.subscribe((tag) => (language = tag)))

// What each switch holds now. A switch is the game's, so its own `get` is the truth after every `set`. The switches
// are fixed for the mount.
// svelte-ignore state_referenced_locally
let held = $state(switches.map((each) => each.get()))

function flip(index: number, on: boolean): void {
  const each = switches[index]
  if (each === undefined) return
  each.set(on)
  held[index] = each.get()
}

const labelOf = (each: WarningSwitch): string =>
  typeof each.label === 'function' ? each.label(language) : each.label
</script>

<Modal title={words.title} closeLabel={words.close} onclose={ondone} testId="photosensitivity-warning">
  <p class="af-warning__body">{words.body}</p>
  {#if switches.length > 0}
    <section class="af-warning__switches" data-warning-switches aria-labelledby="af-warning-choose">
      <h3 id="af-warning-choose" class="af-warning__heading">{words.choose}</h3>
      {#each switches as each, index (each.id)}
        <Toggle
          label={labelOf(each)}
          checked={held[index] === true}
          onLabel={copy.current.settings.audio.on}
          offLabel={copy.current.settings.audio.off}
          testId={`warning-switch-${each.id}`}
          onchange={(on) => flip(index, on)}
        />
      {/each}
    </section>
  {/if}
  <p class="af-warning__note" data-display-motion>{copy.current.settings.display.reducedMotion(reducedMotion)}</p>
  <p class="af-warning__note">{words.later}</p>
  {#snippet actions()}
    <button
      type="button"
      class="af-control af-warning__continue"
      data-kind="primary"
      data-testid="photosensitivity-continue"
      data-initial-focus
      onclick={ondone}>{words.continue}</button
    >
  {/snippet}
</Modal>

<style>
  .af-warning__body,
  .af-warning__note {
    margin: 0 0 12px;
  }

  .af-warning__note {
    color: var(--af-muted);
  }

  .af-warning__switches {
    display: grid;
    gap: 8px;
    margin: 0 0 12px;
  }

  .af-warning__heading {
    margin: 0;
    font-size: var(--af-text-body);
  }

  .af-warning__continue {
    width: 100%;
    justify-content: center;
  }
</style>
