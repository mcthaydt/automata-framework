<!--
  The row parts together as an inspector draws them: a Section of Rows (one chosen, one with actions), a Section of
  Fields in a Block, and a label-left field with a hint and a warning. Used by the unit test (behaviour) and the layout
  test (production CSS in a real browser).
-->
<script lang="ts">
import Block from '../../shared/kit/rows/Block.svelte'
import Field from '../../shared/kit/rows/Field.svelte'
import Row from '../../shared/kit/rows/Row.svelte'
import Section from '../../shared/kit/rows/Section.svelte'
import IconButton from '../../shared/kit/widgets/IconButton.svelte'
import Stepper from '../../shared/kit/widgets/Stepper.svelte'

interface Props {
  /** Puts a Block inside a Block, which must throw. */
  nested?: boolean
  /** Gives the Name field a warning as well as its hint. */
  warnName?: boolean
  onadd?: () => void
  onremove?: () => void
}

const { nested = false, warnName = false, onadd = () => {}, onremove = () => {} }: Props = $props()
const layers = ['Entities', 'Decor', 'Ground', 'Collision']
let chosen = $state('Decor')
</script>

<div class="inspector">
  <Section label="Layers" count={layers.length} {onadd} addLabel="Add a layer">
    {#each layers as layer (layer)}
      <Row selected={layer === chosen} meta={layer === 'Entities' ? '6' : undefined} onclick={() => (chosen = layer)}>
        {#snippet lead()}<span class="swatch"></span>{/snippet}
        {layer}
        {#snippet actions()}
          <IconButton icon="eye" label={`Hide ${layer}`} />
          <IconButton icon="lock" label={`Lock ${layer}`} />
        {/snippet}
      </Row>
    {/each}
  </Section>
  <Section label="Details">
    <Field
      label="Name"
      hint="What the level is called in the list."
      warning={warnName ? 'Name is already taken.' : undefined}
    >
      <input aria-label="Name" value="Start" />
    </Field>
    <Field label="Depth" warning="Depth is past the ground." labelled>
      <Stepper label="Depth" value={3} min={0} max={9} step={1} integer />
    </Field>
  </Section>
  <Block title="Jump" icon="zap" {onremove}>
    <Field label="Height"><input aria-label="Height" value="3" /></Field>
    <Field label="Speed"><input aria-label="Speed" value="6" /></Field>
    {#if nested}
      <Block title="Inner" icon="zap"><Field label="Odd"><input aria-label="Odd" /></Field></Block>
    {/if}
  </Block>
</div>

<style>
  .inspector {
    width: 320px;
    background: var(--paper);
    color: var(--ink);
    font: var(--text-body-13);
  }
  .swatch {
    width: 12px;
    height: 12px;
    border-radius: var(--edge-sm);
    background: var(--cobalt);
  }
  input {
    box-sizing: border-box;
    min-height: var(--size-field);
    width: 100%;
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-sm);
    background: var(--bg);
    color: var(--ink);
    font: var(--text-body-13);
  }
</style>
