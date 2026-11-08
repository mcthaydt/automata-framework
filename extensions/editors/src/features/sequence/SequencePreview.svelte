<!--
  The scene at the playhead seen from above: the walls of a level (2D or 3D) the person picks, each person as a dot with a name
  and the way they face, the camera as a wedge showing what it sees, the words on screen under the plan, and the fade as
  darkening. It is drawn from the director's state; it never runs the game.
-->
<script lang="ts">
import { planView } from './plan-view.ts'
import type { SequenceSession } from './sequence-session.svelte.ts'

const { session }: { session: SequenceSession } = $props()
const SIZE = { w: 400, h: 260 }
const RADIANS = Math.PI / 180

const state = $derived(session.state)
const plan = $derived(state === undefined ? undefined : planView(state, session.walls, SIZE))
const words = $derived(plan?.captionLine === undefined ? undefined : session.lineWords.get(plan.captionLine))

function wedge(camera: NonNullable<typeof plan>['camera']): string {
  const reach = 70
  const half = (camera.spread * RADIANS) / 2
  const a = camera.angle * RADIANS
  const point = (angle: number): string =>
    `${(camera.x + Math.cos(angle) * reach).toFixed(1)},${(camera.y + Math.sin(angle) * reach).toFixed(1)}`
  return `${camera.x.toFixed(1)},${camera.y.toFixed(1)} ${point(a - half)} ${point(a + half)}`
}
</script>

<section class="preview" aria-label="Preview">
  {#if session.levels.length > 0}
    <label class="over">
      Show over:
      <select
        value={session.level ?? ''}
        onchange={(event) => void session.showOver(event.currentTarget.value === '' ? undefined : event.currentTarget.value)}
      >
        <option value="">Nothing</option>
        {#each session.levels as level (level.path)}<option value={level.path}>{level.name}</option>{/each}
      </select>
    </label>
  {/if}
  {#if plan !== undefined}
    <svg viewBox="0 0 {SIZE.w} {SIZE.h}" role="img" aria-label="The scene from above">
      <rect class="floor" width={SIZE.w} height={SIZE.h} />
      {#each plan.walls as wall, at (at)}
        <line class="wall" x1={wall[0]} y1={wall[1]} x2={wall[2]} y2={wall[3]} />
      {/each}
      <polygon class="view" points={wedge(plan.camera)} />
      <circle class="eye" cx={plan.camera.x} cy={plan.camera.y} r="4" />
      {#each plan.actors as actor (actor.name)}
        <g opacity={Math.max(0.2, actor.alpha)}>
          <circle class="dot" cx={actor.x} cy={actor.y} r="7" />
          <line
            class="turn"
            x1={actor.x}
            y1={actor.y}
            x2={actor.x + Math.cos(actor.facing * RADIANS) * 14}
            y2={actor.y + Math.sin(actor.facing * RADIANS) * 14}
          />
          <text x={actor.x + 10} y={actor.y - 8}>{actor.name}</text>
        </g>
      {/each}
      <rect class="dark" width={SIZE.w} height={SIZE.h} opacity={plan.fade} />
    </svg>
    <p class="words" aria-live="polite">{words ?? ''}</p>
  {/if}
</section>

<style>
  .preview {
    display: grid;
    gap: var(--space-2);
    min-height: 200px;
  }
  svg {
    width: 100%;
    max-height: 40dvh;
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
  }
  .floor {
    fill: var(--color-bg-field);
  }
  .wall {
    stroke: var(--color-text-faint);
    stroke-width: 2;
  }
  .view {
    fill: var(--color-accent-soft);
    stroke: var(--color-accent-default);
    stroke-width: 1;
  }
  .eye {
    fill: var(--color-accent-default);
  }
  .dot {
    fill: var(--color-text-primary);
  }
  .turn {
    stroke: var(--color-text-primary);
    stroke-width: 2;
  }
  text {
    fill: var(--color-text-primary);
    font: var(--text-body-13);
  }
  .dark {
    fill: black;
    pointer-events: none;
  }
  .over,
  .words {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .words {
    min-height: 1.5em;
    color: var(--color-text-primary);
    text-align: center;
  }
  select {
    min-height: var(--size-hit);
    margin-left: var(--space-2);
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-field);
    color: var(--color-text-primary);
    font: var(--text-body-13);
  }
</style>
