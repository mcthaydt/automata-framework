<!--
  @component
  The Language group of the Settings tab (Owner, 2026-10-18), laid out as FloorFifty's (`LanguagePicker.svelte` at
  a28dc44): Automatic, then each of the game's languages by its endonym, each in its own `lang` so a screen reader
  says it in that language. A pick is reported at once (`Locale.set`); nothing remounts, so focus stays on it.
  FloorFifty's flags are its own art; a game names its languages here, and may give its own names (`names`).
-->
<script lang="ts">
import OptionGroup from '../layout/OptionGroup.svelte'
import { endonymOf, type LanguageCopy } from './language-section'

interface Props {
  copy: LanguageCopy
  /** The game's locales, in its own order (`Locale.locales`). */
  locales: readonly string[]
  /** The player's pick, or null for Automatic (`Locale.choice`). */
  choice: string | null
  onchange: (choice: string | null) => void
  /** A game's own names for its languages, where it wants other than the browser's. */
  names?: Readonly<Record<string, string>> | undefined
}

const { copy, locales, choice, onchange, names }: Props = $props()

// Automatic is the empty value: a radio's value is a string, and no locale tag is empty.
const AUTOMATIC = ''
const options = $derived([
  { value: AUTOMATIC, label: copy.automatic, testId: 'language-auto' },
  ...locales.map((tag) => ({
    value: tag,
    label: names?.[tag] ?? endonymOf(tag),
    lang: tag,
    testId: `language-${tag}`,
  })),
])
</script>

<section class="af-language" data-settings-section="language">
  <h3 class="af-settings__heading">{copy.title}</h3>
  <OptionGroup
    label={copy.title}
    legendHidden
    {options}
    value={choice ?? AUTOMATIC}
    onchange={(value) => onchange(value === AUTOMATIC ? null : value)}
  />
</section>

<style>
  .af-language {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
