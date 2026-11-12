<!--
  The first run's screens for the layout contracts: `language` is the language screen with all six languages; `warning`
  is the photosensitivity warning with two switches and all four declared effects (the longest sentence it says). Words are the default English words, said in the `locale` the
  contract runs in.
-->
<script lang="ts" module>
export const FIRST_RUN_SHOWS = ['language', 'warning'] as const
export type FirstRunShow = (typeof FIRST_RUN_SHOWS)[number]
</script>

<script lang="ts">
import LanguageFirst from '../../app/opening/LanguageFirst.svelte'
import PhotosensitivityWarning from '../../app/opening/PhotosensitivityWarning.svelte'
import { DEFAULT_SCREENS_COPY, type ScreensCopy } from '../../app/screens/screens-copy'
import { type FixtureLocale, say } from './locale-fixture'

const { show, locale = 'en' }: { show: FirstRunShow; locale?: FixtureLocale } = $props()

/** A word in the contract's locale. A fixture's props are fixed for its mount. */
const t = (text: string): string => say(locale, text)
const words = DEFAULT_SCREENS_COPY.firstRun
const copy: ScreensCopy = {
  ...DEFAULT_SCREENS_COPY,
  firstRun: {
    language: { title: t(words.language.title), close: t(words.language.close) },
    warning: {
      title: t(words.warning.title),
      body: t(words.warning.body),
      declared: (effects) => t(words.warning.declared(effects)),
      effects: {
        flashing: t(words.warning.effects.flashing),
        strobing: t(words.warning.effects.strobing),
        shaking: t(words.warning.effects.shaking),
        patterns: t(words.warning.effects.patterns),
      },
      choose: t(words.warning.choose),
      later: t(words.warning.later),
      continue: t(words.warning.continue),
      close: t(words.warning.close),
    },
  },
  settings: {
    ...DEFAULT_SCREENS_COPY.settings,
    audio: { ...DEFAULT_SCREENS_COPY.settings.audio, on: t('On'), off: t('Off') },
    display: {
      ...DEFAULT_SCREENS_COPY.settings.display,
      reducedMotion: (reduced) => t(DEFAULT_SCREENS_COPY.settings.display.reducedMotion(reduced)),
    },
  },
}
// Two switches, one on, as a game with feel passes: its flashing and its shaking.
const held = $state({ flashing: true, shaking: false })
const switches = [
  { id: 'flashing', label: t('Fewer flashes'), get: () => held.flashing, set: (on: boolean) => void (held.flashing = on) },
  { id: 'shaking', label: t('Less shaking'), get: () => held.shaking, set: (on: boolean) => void (held.shaking = on) },
]
const reader = { current: 'en', subscribe: () => none }
const live = { current: copy }
const none = (): void => undefined
</script>

{#if show === 'language'}
  <LanguageFirst
    locales={['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans']}
    detected="ko"
    copy={live}
    onpick={none}
    onclose={none}
  />
{:else}
  <PhotosensitivityWarning
    copy={live}
    locale={reader}
    {switches}
    effects={['flashing', 'strobing', 'shaking', 'patterns']}
    reducedMotion={false}
    ondone={none}
  />
{/if}
