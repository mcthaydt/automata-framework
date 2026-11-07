<!--
  @component
  A number in a range: a labelled native `<input type="range">`, so the browser
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
  /** `stacked` (the default): the label above the track. `row`: the label, the track and the value on one row, like a
   * volume row. */
  layout?: 'stacked' | 'row' | undefined
  /** The thumb let go (the input's `change`): a volume plays its sample then. */
  onrelease?: ((value: number) => void) | undefined
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
  onrelease,
}: Props = $props()

const id = $props.id()
const words = $derived(valueText(value))
// How far along its range the value is: the track fills with the accent up to it.
const fill = $derived(`${max === min ? 0 : Math.round(((value - min) / (max - min)) * 100)}%`)
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
    style:--af-slider-fill={fill}
    oninput={(event) => onchange(Number(event.currentTarget.value))}
    onchange={(event) => onrelease?.(Number(event.currentTarget.value))}
  />
  <span class="af-slider__value" aria-hidden="true">{words}</span>
</div>

<style>
  .af-slider {
    /* The drawn thumb: 20 px, scaled with TV mode as the targets are. */
    --af-slider-thumb: calc(20px * var(--af-scale, 1));
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

  /* The track is drawn thin and fills with the accent up to the value; the thumb is drawn small,
     and the input itself, the whole 44 px row, is what a finger hits: a press anywhere on it moves the value there.
     Each engine needs its own selector. */
  .af-slider__input::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 3px;
    background: linear-gradient(
      to right,
      var(--af-accent) var(--af-slider-fill, 0%),
      var(--af-edge) var(--af-slider-fill, 0%)
    );
  }

  .af-slider__input::-moz-range-track {
    height: 6px;
    border-radius: 3px;
    background: var(--af-edge);
  }

  .af-slider__input::-moz-range-progress {
    height: 6px;
    border-radius: 3px;
    background: var(--af-accent);
  }

  .af-slider__input::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: var(--af-slider-thumb);
    height: var(--af-slider-thumb);
    margin-top: calc((6px - var(--af-slider-thumb)) / 2);
    border: var(--af-edge-width) solid var(--af-on-accent);
    border-radius: 50%;
    background: var(--af-accent);
  }

  .af-slider__input::-moz-range-thumb {
    box-sizing: border-box;
    width: var(--af-slider-thumb);
    height: var(--af-slider-thumb);
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
