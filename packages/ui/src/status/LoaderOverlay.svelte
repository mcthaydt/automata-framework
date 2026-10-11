<!--
  The loader over a screen while its assets load (M1.6 spec §3.4; from FloorFifty
  `ui/components/LoaderOverlay.svelte` at 122a220). It shows real progress when the runtime has it
  and an indeterminate bar before the first byte, says what is loading in words, and after the
  runtime's slow threshold says quietly that it is slow, not failing. The slow line always holds
  its height, so nothing shifts when it appears.
-->
<script lang="ts">
interface Props {
  label: string
  /** 0..1; absent while unknown. */
  progress?: number | undefined
  slow?: boolean | undefined
  slowLabel: string
}

const { label, progress, slow = false, slowLabel }: Props = $props()

const percent = $derived(
  progress === undefined ? undefined : Math.round(Math.min(1, Math.max(0, progress)) * 100),
)
</script>

<div class="af-loader" data-testid="loader-overlay">
  <p class="af-loader__label">{label}</p>
  <div
    class="af-loader__bar"
    role="progressbar"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={percent}
    data-indeterminate={percent === undefined ? '' : undefined}
  >
    <div class="af-loader__fill" style:width={percent === undefined ? undefined : `${percent}%`}></div>
  </div>
  <p class="af-loader__slow" aria-live="polite" data-testid="loader-slow">{#if slow}{slowLabel}{/if}</p>
</div>

<style>
  .af-loader {
    position: fixed;
    inset: 0;
    z-index: 90;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 12px;
    padding: var(--af-gutter);
    background: var(--af-scrim);
    color: var(--af-ink);
    font: var(--af-text-body) / 1.4 var(--af-font);
  }

  .af-loader__label,
  .af-loader__slow {
    margin: 0;
    text-align: center;
  }

  .af-loader__slow {
    min-height: 1.4em;
    color: var(--af-muted);
    font-size: var(--af-text-small);
  }

  .af-loader__bar {
    width: min(70vw, 20rem);
    height: 12px;
    border: var(--af-edge-width) solid var(--af-edge);
    border-radius: var(--af-radius);
    overflow: hidden;
    background: var(--af-panel);
  }

  .af-loader__fill {
    height: 100%;
    background: var(--af-accent);
  }

  /* Unknown progress: a block that sweeps, still when the player asks for reduced motion. */
  .af-loader__bar[data-indeterminate] .af-loader__fill {
    width: 30%;
    animation: af-loader-sweep 1.2s linear infinite;
  }

  @keyframes af-loader-sweep {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(340%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .af-loader__bar[data-indeterminate] .af-loader__fill {
      animation: none;
      width: 100%;
      opacity: 0.5;
    }
  }
</style>
