<!--
  The inspector's Look tab (EDS.9a; editor suite spec §6.2, EDS-D16): the chosen figure's fields. Its swatch, gait, hand,
  default outfit and stand are pickers over the game's own files; the body's sliders and the face's fourteen (in five
  folded groups) are sliders held to the schema's range; the outfits are chips that dress the stage. An edit is one step
  and a refusal shows under the fields in the schema's own sentence.
-->
<script lang="ts">
import { Chips, Picker, Segmented, Slider } from '@mcthaydt/automata-editor/kit'
import type { StudioController } from '../studio-controller'
import { BODY_SLIDERS, FACE_GROUPS, type SliderField, sliderValue } from '../studio-fields'

const { controller }: { controller: StudioController } = $props()

// svelte-ignore state_referenced_locally
const revision = controller.revision
// svelte-ignore state_referenced_locally
const viewState = controller.view.state
const content = $derived.by(() => {
  void $revision
  return controller.content()
})
const figure = $derived(content.figures.find((entry) => entry.id === $viewState.figure))
const def = $derived(figure?.value)

const swatches = $derived(
  Object.keys(content.library.swatches)
    .sort()
    .map((id) => ({ id, label: id })),
)
const gaits = $derived(
  Object.keys(content.motion.gaits)
    .sort()
    .map((id) => ({ id, label: id })),
)
const stands = $derived([
  { id: '', label: 'None (relaxed idle)' },
  ...Object.keys(content.motion.stands)
    .sort()
    .map((id) => ({ id, label: id })),
])
const outfits = $derived(Object.keys(def?.outfits ?? {}).map((id) => ({ id, label: id })))
const shownOutfit = $derived($viewState.outfit ?? def?.default ?? '')

function slide(field: SliderField, value: number, phase: string): void {
  if (phase !== 'set' && phase !== 'commit') return
  void (value === field.default && field.path.length === 2
    ? controller.resetSlider(field.path)
    : controller.setSlider(field.path, value))
}
</script>

{#snippet slider(field: SliderField)}
  <Slider
    label={field.label}
    value={sliderValue(def?.sliders ?? {}, field)}
    min={field.min}
    max={field.max}
    step={field.step}
    defaultValue={field.default}
    unit={field.unit}
    onedit={(event) => slide(field, event.value, event.phase)}
  />
{/snippet}

{#if def === undefined}
  <p class="none">{figure === undefined ? 'No figure is chosen.' : 'This figure has a problem; see the panel.'}</p>
{:else}
  <div class="look" data-testid="studio-look">
    <h2>{figure?.id}</h2>
    <Picker label="Skin" value={def.skin} options={swatches} onpick={(id) => void controller.setFigureField('skin', id)} />
    <Picker
      label="Gait"
      value={typeof def.gait === 'string' ? def.gait : undefined}
      placeholder="Written in the file"
      options={gaits}
      onpick={(id) => void controller.setFigureField('gait', id)}
    />
    <div class="labelled">
      <span class="name">Hand</span>
      <Segmented
        label="Hand"
        value={def.hand}
        options={[{ id: 'L', label: 'Left' }, { id: 'R', label: 'Right' }]}
        onedit={(event) => void controller.setFigureField('hand', event.value)}
      />
    </div>
    <Picker label="Default outfit" value={def.default} options={outfits} onpick={(id) => void controller.setFigureField('default', id)} />
    <Picker
      label="Stand"
      value={def.stand ?? ''}
      options={stands}
      onpick={(id) => void controller.setFigureField('stand', id === '' ? undefined : id)}
    />
    <Chips
      label="Outfit on the stage"
      mode="single"
      items={outfits}
      selected={[shownOutfit]}
      onedit={(event) => controller.view.setOutfit(event.value[0])}
    />
    <h3>Body</h3>
    {#each BODY_SLIDERS as field (field.id)}{@render slider(field)}{/each}
    <h3>Face</h3>
    {#each FACE_GROUPS as group (group.id)}
      <details>
        <summary>{group.label}</summary>
        {#each group.sliders as field (field.id)}{@render slider(field)}{/each}
      </details>
    {/each}
  </div>
{/if}

<style>
  .look {
    display: grid;
    gap: var(--space-3);
  }
  h2,
  h3 {
    margin: 0;
    font: var(--text-title-15);
  }
  h3 {
    color: var(--color-text-dim);
    font: var(--text-eyebrow-11);
    letter-spacing: var(--text-eyebrow-11-tracking);
    text-transform: uppercase;
  }
  summary {
    display: flex;
    align-items: center;
    min-height: 44px;
    cursor: pointer;
  }
  details {
    display: grid;
    gap: var(--space-2);
  }
  .none {
    margin: 0;
    color: var(--color-text-dim);
  }
  .labelled {
    display: grid;
    gap: var(--space-1);
  }
  .name {
    color: var(--color-text-dim);
    font: var(--text-label-12);
  }
</style>
