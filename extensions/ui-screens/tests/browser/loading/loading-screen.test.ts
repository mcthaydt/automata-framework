import '@automata/framework/theme.css'
import { mountFixture } from '@automata/framework/testing'
import LoadingScreen from '#src/features/loading/LoadingScreen.svelte'
import { type Locale, layoutContract, say } from '#src/testing/layout-sweep.ts'

// The loading screen has no control: the contract is that the title, the bar and the slow line stay inside the visible region.
const mount = (locale: Locale, slow: boolean) =>
  mountFixture(LoadingScreen, {
    title: say(locale, 'Moss Garden'),
    label: say(locale, 'Loading'),
    slowLabel: say(locale, 'Still loading, this can take a moment on a slow connection'),
    progress: 0.4,
    slow,
  })

layoutContract('loading', (locale) => mount(locale, false), [])
layoutContract('loading (slow)', (locale) => mount(locale, true), [])
