<!--
  The game's editor list did not load: what is wrong and where, in the list's own key
  names, and that every editor is read only until it is fixed. "Start a list" comes with the host's write path.
-->
<script lang="ts">
import { EDITOR_LIST_PATH, type EditorListProblem } from '../core'
import { keyPathText } from './home-model'

interface Props {
  problems: readonly EditorListProblem[]
}

const { problems }: Props = $props()

function where(problem: EditorListProblem): string | undefined {
  if (problem.kind === 'missing') return undefined
  if (problem.kind === 'newer-format') return problem.format
  if (problem.line !== undefined) return `line ${problem.line}, column ${problem.column ?? 1}`
  return keyPathText(problem.keyPath)
}
</script>

<section class="problems" role="alert">
  <h2>The editor list has a problem</h2>
  <p>
    {problems.some((problem) => problem.kind === 'missing')
      ? `This game has no ${EDITOR_LIST_PATH}, so the suite doesn't know which editor edits which file.`
      : `${EDITOR_LIST_PATH} can't be read.`}
    Every editor is read only until it is fixed.
  </p>
  <ul>
    {#each problems as problem, index (index)}
      {@const at = where(problem)}
      <li>
        {#if at !== undefined}<code>{at}</code>{/if}
        <span>{problem.message}</span>
      </li>
    {/each}
  </ul>
</section>

<style>
  .problems {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--color-state-bad);
    border-radius: var(--edge);
    background: var(--color-bg-surface);
  }
  h2 {
    margin: 0;
    font: var(--text-title-15);
  }
  p {
    margin: 0;
  }
  ul {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    overflow-wrap: anywhere;
  }
  code {
    font: var(--text-mono-12);
    color: var(--color-state-bad);
  }
</style>
