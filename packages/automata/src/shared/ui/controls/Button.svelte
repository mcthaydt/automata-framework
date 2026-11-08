<!--
  @component
  The framework's button: an `.af-control` of one kind. A primary carries
  `data-kind="primary"`, which both sizes it to the 48 px primary target and tells the layout check
  to hold it to that size. The words are the caller's, in the game's language.
-->
<script lang="ts">
import type { Snippet } from 'svelte'

interface Props {
  kind?: 'primary' | 'secondary' | 'ghost' | undefined
  disabled?: boolean | undefined
  onclick?: (() => void) | undefined
  testId?: string | undefined
  children: Snippet
}

const { kind = 'secondary', disabled = false, onclick, testId, children }: Props = $props()
</script>

<button
  type="button"
  class="af-control"
  class:af-control--primary={kind === 'primary'}
  class:af-control--ghost={kind === 'ghost'}
  data-kind={kind}
  data-testid={testId}
  {disabled}
  {onclick}
>
  {@render children()}
</button>
