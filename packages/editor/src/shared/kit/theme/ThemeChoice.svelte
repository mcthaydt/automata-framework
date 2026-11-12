<!--
  "Editor colours": Dark, Light or Match device. It sits at the foot of each Home, where every session starts and where
  it is never in the way of work. Choosing applies at once (no reload) and is remembered in this browser. The words are
  chosen for someone who has never heard of a theme: "Editor colours" says what changes and whose colours they are
  (a bare "Colours" would read as the game's), "Match device" says it does what the phone or computer does. The label
  is visible words above the track; the radio group is named by the same words.
-->
<script lang="ts">
import { onMount } from 'svelte'
import Segmented from '../widgets/Segmented.svelte'
import {
  applyThemeChoice,
  type ThemeChoice as Choice,
  readThemeChoice,
  writeThemeChoice,
} from './theme-choice'

interface Props {
  /** The store the choice is kept in; the page's, unless a test hands one in. Reads and writes are guarded. */
  storage?: (() => Storage | undefined) | undefined
  /** The element carrying `data-theme`; the page's `<html>`. */
  root?: HTMLElement | undefined
}

const { storage = () => globalThis.localStorage, root }: Props = $props()

const OPTIONS = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'device', label: 'Match device' },
]

// svelte-ignore state_referenced_locally
let choice = $state<string>(readThemeChoice(storage))
const target = (): HTMLElement => root ?? document.documentElement

// A page whose boot script did not run (a test, another host) still opens in the remembered look.
onMount(() => applyThemeChoice(choice as Choice, target()))

function choose(next: string): void {
  writeThemeChoice(next as Choice, storage)
  applyThemeChoice(next as Choice, target())
}
</script>

<div class="theme" data-testid="theme-choice">
  <span class="label" aria-hidden="true">Editor colours</span>
  <Segmented label="Editor colours" options={OPTIONS} bind:value={choice} onedit={(event) => choose(event.value)} />
</div>

<style>
  .theme {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }
  .label {
    color: var(--muted);
    font: var(--text-label-12);
  }
</style>
