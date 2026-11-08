<!-- One mode: its name, how fast the character moves in it, where it starts, and the switches that leave it. -->
<script lang="ts">
import { Button } from '@automata/editor/kit'
import type { AgentDef } from '@automata/systems/sim'
import { routineMode } from '@automata/systems/sim'
import FieldRow from '../../shared/ui/FieldRow.svelte'
import { modeNotes } from './decide-words.ts'
import { modeWords, type Names, num } from './pieces/piece.ts'
import type { SchematicSession } from './schematic-session.svelte.ts'
import { switchWords } from './switch-words.ts'

interface Props {
  session: SchematicSession
  agent: number
  character: AgentDef
  mode: string
  names: Names
}

const { session, agent, character, mode, names }: Props = $props()
const speed = $derived(character.speed[mode] ?? 0)
const walks = $derived(routineMode(character) === mode)
const leaving = $derived(
  character.transitions.map((t, index) => ({ t, index })).filter(({ t }) => t.from === mode),
)
const others = $derived(character.modes.filter((m) => m !== mode))
const notes = $derived(modeNotes(character, mode))
</script>

<section class="inspector" aria-label="Mode">
  <h3>{modeWords(mode)}</h3>
  {#if walks}
    <p class="dim">This mode walks the patrol, so it keeps its name.</p>
  {:else}
    <FieldRow
      label="Name"
      kind="text"
      commit="leave"
      value={mode}
      onchange={(next) => void session.renameMode(agent, mode, String(next))}
    />
  {/if}
  <FieldRow
    label="Moves at"
    kind="number"
    unit="m/s"
    min={0}
    max={20}
    step={0.1}
    value={Number(num(speed))}
    onchange={(next) =>
      void session.change(`Change the speed of ${mode}`, [
        { keyPath: ['agents', agent, 'speed', mode], expected: speed, set: Number(next) },
      ])}
  />
  {#if speed === 0}<p class="dim">At 0 it stands still in this mode.</p>{/if}
  {#if character.initial === mode}
    <p class="dim">It starts in this mode.</p>
  {:else}
    <Button
      onclick={() =>
        void session.change(`Start in ${mode}`, [
          { keyPath: ['agents', agent, 'initial'], expected: character.initial, set: mode },
        ])}>Start in this mode</Button
    >
  {/if}
  {#each notes as note (note)}<p class="dim">{note}</p>{/each}

  <h4>Switches out of it</h4>
  {#if leaving.length === 0}<p class="dim">None yet.</p>{/if}
  <ul>
    {#each leaving as { t, index } (index)}
      <li>
        <button type="button" onclick={() => (session.selected = { kind: 'switch', index })}>{switchWords(t, names)}</button>
      </li>
    {/each}
  </ul>
  <div class="buttons">
    {#if others.length > 0}
      <Button onclick={() => void session.addSwitch(agent, mode, others[0] ?? mode)}>Add a switch out of it</Button>
    {/if}
    <Button onclick={() => void session.addMode(agent)}>Add a mode</Button>
  </div>
</section>

<style>
  .inspector {
    display: grid;
    gap: var(--space-3);
  }
  h3 {
    margin: 0;
    color: var(--color-text-primary);
    font: var(--text-title-15);
  }
  h4 {
    margin: var(--space-2) 0 0;
    color: var(--color-text-dim);
    font: var(--text-body-13-medium);
  }
  ul {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li button {
    width: 100%;
    min-height: var(--size-hit);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border-default);
    border-radius: var(--edge-sm);
    background: var(--color-bg-surface);
    color: var(--color-text-primary);
    font: var(--text-body-13);
    text-align: left;
    cursor: pointer;
  }
  .dim {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
