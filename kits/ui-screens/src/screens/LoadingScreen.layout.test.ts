import '@mcthaydt/automata-ui/theme.css'
import { mountFixture } from '@mcthaydt/automata-testing'
import { type Locale, layoutContract, say } from '../testing/layout-sweep'
import LoadingScreen from './LoadingScreen.svelte'

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
