<!--
  A file's problems, counted, in words ("2 problems in the audio file."); "No problems." when it reads cleanly. The first
  problem is said too, so the count is never the whole answer: what is wrong, and where when the editor can say it.
-->
<script lang="ts">
import type { Problem, TomlRead } from '../toml-session.ts'

const {
  read,
  noun,
  describe = (problem) => problem.message,
}: { read: TomlRead<unknown>; noun: string; describe?: (problem: Problem) => string } = $props()
const count = $derived(read.kind === 'invalid' ? read.problems.length : 0)
const first = $derived.by(() => {
  const found = read.kind === 'invalid' ? read.problems[0] : undefined
  if (found === undefined) return undefined
  const said = describe(found).trim()
  return said === '' ? undefined : said.replace(/[.]$/, '')
})
</script>

<p class="status" role="status">
  {#if read.kind === 'syntax'}
    The {noun} has a mistake, so it is read only.
  {:else if count === 1}
    1 problem in the {noun}{first === undefined ? '.' : `: ${first}.`}
  {:else if count > 1}
    {count} problems in the {noun}{first === undefined ? '.' : `. The first: ${first}.`}
  {:else if read.kind === 'ok'}
    No problems.
  {/if}
</p>

<style>
  .status {
    margin: 0;
    color: var(--color-text-dim);
    font: var(--text-body-13);
  }
</style>
