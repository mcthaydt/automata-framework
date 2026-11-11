<!--
  @component
  The objective line: one sentence saying what to do next, in the place the `hud` file gives it. It is fed its words
  already resolved; it wraps inside its piece and scrolls there if a translation is very long, and never grows past the
  screen.
-->
<script lang="ts">
interface Props {
  /** The words, already looked up. */
  text: string
  /** Where the file puts it (`placeStyle`). */
  style: string
}
const { text, style }: Props = $props()
</script>

<p class="hud-objective" data-testid="hud-objective" {style}>{text}</p>

<style>
  .hud-objective {
    box-sizing: border-box;
    margin: 0;
    max-height: 40%;
    overflow-y: auto;
    overflow-wrap: anywhere;
    padding: 8px 12px;
    border: var(--af-edge-width, 2px) solid var(--af-edge, #a6aeba);
    border-radius: var(--af-radius, 6px);
    background: var(--af-surface, #181f2f);
    color: var(--af-ink, #f5f7fa);
    font: var(--af-text-body, 16px) / 1.4 var(--af-font, system-ui, sans-serif);
    pointer-events: auto;
  }
</style>
