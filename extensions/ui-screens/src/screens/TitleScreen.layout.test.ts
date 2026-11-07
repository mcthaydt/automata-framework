import '@mcthaydt/automata-ui/theme.css'
import { PSEUDO_LOCALE } from '@mcthaydt/automata-content/locale'
import { mountFixture } from '@mcthaydt/automata-testing'
import { type Locale, layoutContract, pseudo, say } from '../testing/layout-sweep'
import TitleScreen from './TitleScreen.svelte'

const nothing = (): void => {}
const mount = (locale: Locale, extras: boolean) =>
  mountFixture(TitleScreen, {
    title: say(locale, 'Moss Garden'),
    copy: locale === PSEUDO_LOCALE ? pseudo({ play: 'Play' }) : { play: 'Play' },
    onPlay: nothing,
    ...(extras
      ? {
          extra: [
            { id: 'settings', label: say(locale, 'Settings'), shortLabel: say(locale, 'Set') },
            { id: 'credits', label: say(locale, 'Credits'), shortLabel: say(locale, 'Info') },
          ],
          onAction: nothing,
        }
      : {}),
  })

layoutContract('title', (locale) => mount(locale, false), ['play'])
layoutContract('title (more actions)', (locale) => mount(locale, true), ['play', 'settings', 'credits'])
