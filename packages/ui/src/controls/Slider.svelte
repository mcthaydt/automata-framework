<!--
  @component
  A number in a range (M4 spec §4.12): a labelled native `<input type="range">`, so the browser
  gives the arrow keys and the focus navigator's `adjust` steps it. `valueText` gives the value its
  words for assistive technology (`aria-valuetext`), and the same words show beside the track. The
  thumb is a 44 px target, checked by the layout contract.
-->
<script lang="ts">
interface Props {
  label: string
  value: number
  min: number
  max: number
  step?: number | undefined
  /** The value in words, in the game's language ("40 percent"). */
  valueText: (value: number) => string
  onchange: (value: number) => void
  disabled?: boolean | undefined
  testId?: string | undefined
  /** `stacked` (the default): the label above the track. `row`: the label, the track and the value on one row, as
   * FloorFifty's volume rows. */
  layout?: 'stacked' | 'row' | undefined
}

const {
  label,
  value,
  min,
  max,
  step = 1,
  valueText,
  onchange,
  disabled = false,
  testId,
  layout = 'stacked',
}: Props = $props()

const id = $props.id()
const words = $derived(valueText(value))
</script>

<div class="af-slider" data-testid={testId} data-layout={layout}>
  <label class="af-slider__label" for={id}>{label}</label>
  <input
    {id}
    class="af-slider__input"
    type="range"
    {min}
    {max}
    {step}
    {value}
    {disabled}
    aria-valuetext={words}
    oninput={(event) => onchange(Number(event.currentTarget.value))}
  />
  <span class="af-slider__value" aria-hidden="true">{words}</span>
</div>

<style>
  .af-slider {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 4px 12px;
  }

  .af-slider__input {
    grid-column: 1 / -1;
    grid-row: 2;
    width: 100%;
    min-height: var(--af-target);
    margin: 0;
    background: transparent;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    touch-action: manipulation;
  }

  /* One row: the name, the track taking the rest, the value in a column of its own so the tracks line up. */
  .af-slider[data-layout='row'] {
    grid-template-columns: minmax(5em, auto) minmax(0, 1fr) 4ch;
  }

  .af-slider[data-layout='row'] .af-slider__input {
    grid-column: 2;
    grid-row: 1;
  }

  .af-slider[data-layout='row'] .af-slider__value {
    text-align: end;
  }

  .af-slider__value {
    color: var(--af-muted);
    font-size: var(--af-text-small);
  }

  /* The track is drawn thin; the thumb is a whole target. Each engine needs its own selector. */
  .af-slider__input::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 3px;
    background: var(--af-edge);
  }

  .af-slider__input::-moz-range-track {
    height: 6px;
    border-radius: 3px;
    background: var(--af-edge);
  }

  .af-slider__input::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: var(--af-target);
    height: var(--af-target);
    margin-top: calc((6px - var(--af-target)) / 2);
    border: var(--af-edge-width) solid var(--af-on-accent);
    border-radius: 50%;
    background: var(--af-accent);
  }

  .af-slider__input::-moz-range-thumb {
    box-sizing: border-box;
    width: var(--af-target);
    height: var(--af-target);
    border: var(--af-edge-width) solid var(--af-on-accent);
    border-radius: 50%;
    background: var(--af-accent);
  }

  .af-slider__input:focus-visible {
    outline: var(--af-ring-width) solid var(--af-ring);
    outline-offset: 2px;
  }

  .af-slider__input:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
