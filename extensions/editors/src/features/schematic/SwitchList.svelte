<!--
  A character's switches in three groups, the times the game asks them: all the time, the moment it hears a noise, and
  after it stops or gets stuck. Inside a group they are in the order they are checked.
-->
<script lang="ts">
import { Row } from '@automata/editor/kit'
import type { AgentDef } from '@automata/systems/sim'
import { switchNote } from './decide-words.ts'
import type { Names } from './pieces/piece.ts'
import type { Selection } from './schematic-session.svelte.ts'
import { groupOf, switchWords, TIMING_GROUPS } from './switch-words.ts'

interface Props {
  character: AgentDef
  names: Names
  selected: Selection | undefined
  onselect: (selection: Selection) => void
}

const { character, names, selected, onselect }: Props = $props()
</script>

<div class="groups">
  {#each TIMING_GROUPS as group (group.timing)}
    {@const members = groupOf(character, group.timing)}
    <section aria-label={group.title}>
      <h3>{group.title}</h3>
      {#if members.length === 0}
        <p class="none">None.</p>
      {:else}
        <ol>
          {#each members as index (index)}
            {@const t = character.transitions[index]}
            {#if t !== undefined}
              <li>
                <Row
                  selected={selected?.kind === 'switch' && selected.index === index}
                  detail={switchNote(character, index)}
                  onclick={() => onselect({ kind: 'switch', index })}
                >
                  {switchWords(t, names)}
                </Row>
              </li>
            {/if}
          {/each}
        </ol>
      {/if}
    </section>
  {/each}
</div>

<style>
  .groups {
    display: grid;
    gap: var(--space-4);
  }
  section {
    display: grid;
    gap: var(--space-2);
  }
  h3 {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13-medium);
  }
  ol {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .none {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
</style>
