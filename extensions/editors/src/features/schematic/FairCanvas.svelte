<!--
  Fair play: how the scene is meant to play (the scenarios as sentences, the thresholds as numbers with words), and a
  button that has the game's own code play it and say whether it is fair. The check is the game's, so the page says what
  it needs when the game has none, and a result greys when the file changes after it.
-->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import FieldRow from '../../shared/ui/FieldRow.svelte'
import { fairVerdict, scenarioWords } from './fair-words.ts'
import { sceneNames } from './names.ts'
import { num } from './pieces/piece.ts'
import type { SchematicSession } from './schematic-session.svelte.ts'

const { session }: { session: SchematicSession } = $props()
const def = $derived(session.def)
const names = $derived(sceneNames(session, 0))
const README = 'https://github.com/mcthaydt/automata-framework/blob/main/extensions/systems/README.md'
const percent = (fraction: number): number => Math.round(fraction * 1000) / 10

const THRESHOLDS = [
  {
    key: 'cautiousWin',
    label: 'A careful player wins at least',
    unit: '%',
    percent: true,
    min: 0,
    max: 100,
    step: 5,
  },
  {
    key: 'firstThreatAfter',
    label: 'The first threat comes after at least',
    unit: 's',
    percent: false,
    min: 0,
    max: 600,
    step: 1,
  },
  {
    key: 'telegraph',
    label: 'A warning comes at least',
    unit: 's before it',
    percent: false,
    min: 0,
    max: 30,
    step: 0.5,
  },
  {
    key: 'maxDeathsPerRun',
    label: 'A run costs at most',
    unit: 'deaths',
    percent: false,
    min: 0,
    max: 20,
    step: 1,
  },
  {
    key: 'safeWindowMargin',
    label: 'Safe time is at least',
    unit: '× the threat',
    percent: false,
    min: 0,
    max: 10,
    step: 0.1,
  },
] as const
</script>

<section class="fair" aria-label="Fair play">
  <h2>Fair play</h2>
  {#if def !== undefined && names !== undefined}
    <h3>What a fair scene is</h3>
    <ul>
      {#each THRESHOLDS as t (t.key)}
        <li>
          <FieldRow
            label={t.label}
            kind="number"
            unit={t.unit}
            min={t.min}
            max={t.max}
            step={t.step}
            value={t.percent ? percent(def.fairness[t.key]) : def.fairness[t.key]}
            onchange={(next) => void session.setFairNumber('Change what is fair', ['fairness', t.key], t.percent ? Number(next) / 100 : Number(next))}
          />
        </li>
      {/each}
    </ul>

    <h3>Tried one by one</h3>
    {#if def.scenarios.length === 0}<p class="dim">No scenarios yet. A scenario is a made-up player tried on this scene, and this scene’s file has none.</p>{/if}
    <ul>
      {#each def.scenarios as scenario, i (scenario.id)}
        <li class="card">
          <p class="sentence">{scenarioWords(scenario, names)}</p>
          <FieldRow label="Within" kind="number" unit="s" min={0.1} max={600} step={1} value={scenario.expect.within} onchange={(next) => void session.setFairNumber('Change a scenario', ['scenarios', i, 'expect', 'within'], Number(next))} />
          <FieldRow label="Wins at least" kind="number" unit="%" min={0} max={100} step={5} value={percent(scenario.expect.probability)} onchange={(next) => void session.setFairNumber('Change a scenario', ['scenarios', i, 'expect', 'probability'], Number(next) / 100)} />
          <FieldRow label="Tries" kind="number" min={1} max={500} step={1} value={scenario.seeds} onchange={(next) => void session.setFairNumber('Change a scenario', ['scenarios', i, 'seeds'], Number(next))} />
        </li>
      {/each}
    </ul>

    <h3>Is it fair?</h3>
    {#if !session.fairAvailable}
      <p class="dim">
        Your game cannot check fair play yet. Ask whoever writes your game’s code to add a fair-play check.
        <a href={README}>How to add it</a>
      </p>
    {:else}
      <Button variant="primary" disabled={session.fairRunning} onclick={() => void session.checkFair()}>
        {session.fairRunning ? 'Checking…' : 'Check now'}
      </Button>
      {#if session.fair !== undefined}
        {@const stale = session.fairStale}
        <div class="result" data-stale={stale}>
          <p class="sentence" role="status">{fairVerdict(session.fair.result)}</p>
          {#if (session.fair.result.measure ?? []).length > 0}
            <ul aria-label="What the check measured">
              {#each session.fair.result.measure ?? [] as row (row.id)}
                <li data-ok={row.ok}>
                  {row.label}: {num(row.value)}{row.threshold === undefined ? '' : ` (target ${num(row.threshold)})`}
                </li>
              {/each}
            </ul>
          {/if}
          {#if stale}<p class="dim">This is from before your last change. Check again.</p>{/if}
        </div>
      {/if}
    {/if}
  {/if}
</section>

<style>
  .fair {
    display: grid;
    gap: var(--space-3);
  }
  h2 {
    margin: 0;
    color: var(--color-text-primary);
    font: var(--text-title-15);
  }
  h3 {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13-medium);
  }
  ul {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .card,
  .result {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-surface);
  }
  .result[data-stale='true'] {
    opacity: 0.55;
  }
  li[data-ok='false'] {
    color: var(--color-state-bad);
  }
  .sentence {
    margin: 0;
    color: var(--color-text-primary);
    font: var(--text-body-13-medium);
  }
  .dim {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
</style>
