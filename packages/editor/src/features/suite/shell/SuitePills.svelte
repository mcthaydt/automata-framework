<!--
  The top bar's pills: the change set, the checks and
  the reopened gates. Each is a 44 px button that opens its list below it; Escape closes the list. In the `short` tier
  (`compact`) each is an icon with its count, never hidden, and its label stays its accessible name. A check's first
  finding has Locate; a gate shows its recorded decision and link and nothing that records one.
-->
<script lang="ts">
import type { CheckFinding } from '../../../shared/kit/ports/suite-ports'
import type { Pill } from '../core/pills-model'

interface Props {
  pills: readonly Pill[]
  compact: boolean
  onlocate: (finding: CheckFinding) => void
}

const { pills, compact, onlocate }: Props = $props()

const uid = $props.id()
let opened = $state<Pill['icon']>()
/** Where the open list sits: fixed under its pill, inside the window (the bar it is in scrolls sideways). */
let anchor = $state({ top: 0, left: 0, width: 320 })

function toggle(pill: Pill, event: MouseEvent): void {
  if (opened === pill.icon) {
    opened = undefined
    return
  }
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const width = Math.min(320, window.innerWidth - 24)
  anchor = {
    top: box.bottom + 4,
    left: Math.max(12, Math.min(box.left, window.innerWidth - width - 12)),
    width,
  }
  opened = pill.icon
}

const GLYPH: Readonly<Record<Pill['icon'], string>> = { 'change-set': '⎇', checks: '✓', gates: '⚑' }

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && opened !== undefined) {
    event.preventDefault()
    opened = undefined
  }
}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="pills" role="group" aria-label="Change set and checks">
  {#each pills as pill (pill.icon)}
    <div class="pill-wrap">
      <button
        type="button"
        class="pill"
        data-tone={pill.tone}
        aria-expanded={opened === pill.icon}
        aria-controls={`${uid}-${pill.icon}`}
        aria-label={compact ? `${pill.label} (${pill.count})` : undefined}
        onclick={(event) => toggle(pill, event)}
      >
        {#if compact}
          <span aria-hidden="true">{GLYPH[pill.icon]}</span><span class="count">{pill.count}</span>
        {:else}
          {pill.label}
        {/if}
      </button>
      {#if opened === pill.icon}
        <section
          id={`${uid}-${pill.icon}`}
          class="list"
          aria-label={pill.label}
          style:top={`${anchor.top}px`}
          style:left={`${anchor.left}px`}
          style:width={`${anchor.width}px`}
        >
          {#if pill.detail !== undefined}<p class="detail">{pill.detail}</p>{/if}
          {#if pill.items.length === 0}<p class="detail">{pill.label}</p>{/if}
          <ul>
            {#each pill.items as item (item.id)}
              <li data-tone={item.tone}>
                {#if item.href !== undefined}
                  <a href={item.href} target="_blank" rel="noreferrer">{item.label}</a>
                {:else}
                  <span class="name">{item.label}</span>
                {/if}
                {#if item.detail !== undefined}<span class="detail">{item.detail}</span>{/if}
                {#if pill.icon === 'checks' && item.tone !== 'pass' && item.tone !== 'neutral'}
                  <span class="detail">{item.tone}</span>
                {/if}
                {#if item.finding !== undefined}
                  {@const finding = item.finding}
                  <span class="finding">{finding.message}</span>
                  <button type="button" class="locate" aria-label={`Locate ${item.label}`} onclick={() => onlocate(finding)}>
                    Locate
                  </button>
                {/if}
                {#each item.measures ?? [] as measure (measure.label)}
                  <span class="measure" data-ok={measure.ok}>
                    {measure.label} {measure.before ?? '–'} → {measure.after ?? '–'}
                  </span>
                {/each}
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    </div>
  {/each}
</div>

<style>
  .pills {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }
  .pill-wrap {
    flex-shrink: 0;
  }
  .pill {
    min-height: 44px;
    min-width: 44px;
    max-width: 14rem;
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--edge);
    background: var(--color-bg-raised);
    color: var(--color-text-primary);
    font: var(--text-label-12);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }
  .pill[data-tone='pass'] {
    border-color: var(--color-state-ok);
  }
  .pill[data-tone='warn'],
  .pill[data-tone='error'] {
    border-color: var(--color-state-warn);
  }
  .pill[data-tone='fail'] {
    border-color: var(--color-state-bad);
    color: var(--color-state-bad);
  }
  .count {
    font: var(--text-mono-12);
  }
  .list {
    position: fixed;
    z-index: 20;
    box-sizing: border-box;
    max-height: 60vh;
    overflow: auto;
    padding: var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge);
    background: var(--color-bg-surface);
    color: var(--color-text-primary);
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
  li a {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    color: var(--color-accent-default);
  }
  .detail,
  .measure {
    color: var(--color-text-dim);
  }
  .measure[data-ok='false'],
  li[data-tone='fail'] .finding {
    color: var(--color-state-bad);
  }
  .locate {
    min-height: 44px;
    min-width: 44px;
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--edge);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
  }
  p {
    margin: 0 0 var(--space-2);
  }
</style>
