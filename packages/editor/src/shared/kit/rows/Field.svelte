<!--
  One field of an inspector or a block: its name on the left at 108 px, its control on the right, a hint under it in
  quiet words, and a warning under that in `warn` with the alert icon. A field never draws a box of its own; the control
  inside has its edge and a section's or block's hairlines divide fields. The group is named by the name, and described
  by the hint or the warning, so a screen reader hears what the control is for and what is wrong with it.
  `labelled` is for a control that draws its own name and is its own group (a stepper's name is also its scrub handle):
  the field gives that name the same 108 px column instead of a second one, and only adds the hint and the warning.
-->
<script lang="ts">
import type { Snippet } from 'svelte'
import type { HTMLAttributes } from 'svelte/elements'
import Icon from '../icons/Icon.svelte'

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'role'> {
  label: string
  hint?: string | undefined
  warning?: string | undefined
  labelled?: boolean
  children: Snippet
}

const { label, hint, warning, labelled = false, children, ...rest }: Props = $props()

const uid = $props.id()
const described = $derived(
  [warning !== undefined ? `${uid}-warning` : undefined, hint !== undefined ? `${uid}-hint` : undefined]
    .filter((id) => id !== undefined)
    .join(' ') || undefined,
)
</script>

<div
  class="field"
  role={labelled ? undefined : 'group'}
  aria-labelledby={labelled ? undefined : `${uid}-label`}
  aria-describedby={labelled ? undefined : described}
  data-labelled={labelled}
  {...rest}
>
  {#if !labelled}<span class="l" id={`${uid}-label`}>{label}</span>{/if}
  <div class="control">{@render children()}</div>
  {#if hint !== undefined}<p class="note" id={`${uid}-hint`}>{hint}</p>{/if}
  {#if warning !== undefined}
    <p class="note warn" id={`${uid}-warning`} role="alert"><Icon name="alert" size={14} />{warning}</p>
  {/if}
</div>

<style>
  .field {
    display: grid;
    grid-template-columns: 108px minmax(0, 1fr);
    align-items: center;
    gap: 0 var(--space-2);
    min-height: var(--size-hit);
    padding: var(--space-1) var(--field-pad, var(--space-4));
    font: var(--text-body-13);
  }
  .field[data-labelled='true'] {
    grid-template-columns: minmax(0, 1fr);
    --label-flex: 0 0 108px;
  }
  /* A control that draws its own name fills the row and lines the name up in the field's 108 px column. */
  .field[data-labelled='true'] .control > :global(*) {
    flex: 1 1 100%;
  }
  .l {
    color: var(--muted);
  }
  .control {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
  .note {
    grid-column: 1 / -1;
    margin: var(--space-1) 0 0;
    color: var(--tool-faint);
    font: var(--text-label-12);
  }
  .warn {
    display: flex;
    gap: 6px;
    color: var(--warn);
  }
</style>
