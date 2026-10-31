<!--
  base-3d's HUD (DESIGN.md §9.5, GAME-3D.1e part 5a), in the play screen's `hud.overlay` slot: Wick's hearts in
  half steps at the top inline-start (flashing on a hurt), the embers under them, the boss bar at the top centre while
  a Warden lives, and the equipped item and its ammo as a chip at the bottom inline-end, kept off in touch mode (the
  Item button's face is GAME-3D.1h's). It reads the running sim every animation frame (`hudOf`). Only its Items
  button (44 px, under the embers; touch's way to swap items) takes the pointer.
-->
<script lang="ts">
import { InputMethodTracker } from '@mcthaydt/automata-ui'
import { onMount } from 'svelte'
import { liveCopy } from './copy.svelte.ts'
import { type HudState, heartsOf, hudInPlay, hudOf } from './hud.ts'

/** How long the hearts flash after Wick loses health, in ms of presentation time. */
const FLASH_MS = 400

let state = $state<HudState | undefined>(hudOf(hudInPlay.sim))
let flashUntil = $state(0)
let now = $state(0)
const tracker = new InputMethodTracker()

onMount(() => {
  const target = window
  const detach = tracker.attach(target)
  let frame = 0
  const read = (time: number): void => {
    const next = hudOf(hudInPlay.sim)
    if (state !== undefined && next !== undefined && next.health < state.health) flashUntil = time + FLASH_MS
    state = next
    now = time
    frame = target.requestAnimationFrame(read)
  }
  frame = target.requestAnimationFrame(read)
  return () => {
    target.cancelAnimationFrame(frame)
    detach()
  }
})

const hearts = $derived(state === undefined ? [] : heartsOf(state.health, state.maxHealth))
const flashing = $derived(now < flashUntil)
</script>

{#if state !== undefined}
  <div class="b3-hud" data-testid="hud">
    <div class="b3-hud__status">
      <div
        class="b3-hud__hearts"
        class:b3-hud__hearts--flash={flashing}
        data-testid="hud-hearts"
        role="img"
        aria-label={liveCopy.current.hud.hearts(state.health, state.maxHealth)}
      >
        {#each hearts as fill, index (index)}
          <svg class="b3-hud__heart" data-fill={fill} viewBox="0 0 20 18" aria-hidden="true">
            <path class="b3-hud__heart-empty" d="M10 17 1.6 8.6a4.6 4.6 0 0 1 6.5-6.5L10 4l1.9-1.9a4.6 4.6 0 0 1 6.5 6.5Z" />
            {#if fill !== 'empty'}
              <path
                class="b3-hud__heart-fill"
                d={fill === 'full'
                  ? 'M10 17 1.6 8.6a4.6 4.6 0 0 1 6.5-6.5L10 4l1.9-1.9a4.6 4.6 0 0 1 6.5 6.5Z'
                  : 'M10 17 1.6 8.6a4.6 4.6 0 0 1 6.5-6.5L10 4Z'}
              />
            {/if}
          </svg>
        {/each}
      </div>
      <div class="b3-hud__embers" data-testid="hud-embers" aria-label={liveCopy.current.hud.embers(state.embers)}>
        <span class="b3-hud__ember" aria-hidden="true"></span>{state.embers}
      </div>
      {#if hudInPlay.openItems !== undefined}
        <button
          type="button"
          class="af-control af-control--ghost b3-hud__items"
          data-testid="hud-items"
          onclick={() => hudInPlay.openItems?.()}>{liveCopy.current.hud.items}</button
        >
      {/if}
    </div>

    {#if hudInPlay.openMap !== undefined}
      <button
        type="button"
        class="af-control af-control--ghost b3-hud__map"
        data-testid="hud-map"
        onclick={() => hudInPlay.openMap?.()}>{liveCopy.current.hud.map}</button
      >
    {/if}

    {#if state.boss !== undefined}
      {@const name = liveCopy.current.bossNames[state.boss.id] ?? state.boss.id}
      <div class="b3-hud__boss" data-testid="hud-boss">
        <span class="b3-hud__boss-name">{name}</span>
        <div
          class="b3-hud__boss-bar"
          role="meter"
          aria-label={liveCopy.current.hud.bossHealth(name)}
          aria-valuemin="0"
          aria-valuemax={state.boss.max}
          aria-valuenow={state.boss.health}
        >
          <div class="b3-hud__boss-fill" style:inline-size={`${(100 * state.boss.health) / state.boss.max}%`}></div>
        </div>
      </div>
    {/if}

    {#if state.equipped !== undefined && tracker.method !== 'touch'}
      <div class="b3-hud__item" data-testid="hud-item">
        <span>{liveCopy.current.itemNames[state.equipped.item]}</span>
        {#if state.equipped.ammo !== undefined}<span class="b3-hud__ammo">× {state.equipped.ammo}</span>{/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  /* The play field's whole box: the frame's body, inside the visible region (M4.7), above any touch row. */
  .b3-hud {
    position: relative;
    block-size: 100%;
    min-block-size: 0;
    pointer-events: none;
    color: var(--af-ink);
    font: var(--af-text-small);
    text-shadow: 0 1px 2px rgb(0 0 0 / 70%);
  }
  .b3-hud__status {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    display: grid;
    gap: 4px;
  }
  .b3-hud__hearts {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    max-inline-size: calc(10 * 22px);
  }
  .b3-hud__heart {
    inline-size: 20px;
    block-size: 18px;
  }
  .b3-hud__heart-empty {
    fill: rgb(0 0 0 / 45%);
    stroke: var(--af-ink);
    stroke-width: 1.2;
  }
  .b3-hud__heart-fill {
    fill: #e43b44;
  }
  .b3-hud__hearts--flash .b3-hud__heart-fill,
  .b3-hud__hearts--flash .b3-hud__heart-empty {
    fill: #fee761;
  }
  .b3-hud__items {
    justify-self: start;
    min-block-size: 44px;
    min-inline-size: 44px;
    pointer-events: auto;
  }
  /* At the top inline-end, under the frame's corner Pause: the play screen has no seam for a game's corner controls. */
  .b3-hud__map {
    position: absolute;
    inset-block-start: 0;
    inset-inline-end: 0;
    min-block-size: 44px;
    min-inline-size: 44px;
    pointer-events: auto;
  }
  .b3-hud__embers {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .b3-hud__ember {
    inline-size: 10px;
    block-size: 10px;
    border-radius: 50%;
    background: #f77622;
    box-shadow: 0 0 6px #f77622;
  }
  .b3-hud__boss {
    position: absolute;
    inset-block-start: 0;
    inset-inline: 0;
    margin-inline: auto;
    /* Centred, and narrow enough to leave a full row of hearts (10 × 22 px) and a gap clear on both sides. */
    inline-size: min(22rem, calc(100% - 2 * (10 * 22px + 12px)));
    display: grid;
    gap: 2px;
    justify-items: center;
  }
  .b3-hud__boss-bar {
    inline-size: 100%;
    block-size: 10px;
    box-sizing: border-box;
    border: 1px solid var(--af-ink);
    border-radius: 5px;
    background: rgb(0 0 0 / 55%);
    overflow: hidden;
  }
  .b3-hud__boss-fill {
    block-size: 100%;
    background: #e43b44;
  }
  .b3-hud__item {
    position: absolute;
    inset-block-end: 0;
    inset-inline-end: 0;
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 4px 10px;
    border-radius: var(--af-radius);
    background: rgb(0 0 0 / 45%);
  }
</style>
