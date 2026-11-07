import '@mcthaydt/automata-ui/theme.css'
import { PSEUDO_LOCALE } from '@mcthaydt/automata-content/locale'
import { mountFixture } from '@mcthaydt/automata-testing'
import { type Locale, layoutContract, pseudo } from '../testing/layout-sweep'
import PauseScreen from './PauseScreen.svelte'

const nothing = (): void => {}
const COPY = {
  title: 'Paused',
  resume: 'Resume',
  back: 'Back',
  mute: 'Mute',
  unmute: 'Unmute',
  settings: 'Settings',
  quit: 'Quit to title',
  quitPrompt: 'Quit to the title? This run is lost.',
  quitConfirm: 'Quit',
  cancel: 'Cancel',
  reconnect: 'Reconnect your controller to keep playing',
}
const mount = (locale: Locale, reconnect: boolean) =>
  mountFixture(PauseScreen, {
    copy: locale === PSEUDO_LOCALE ? pseudo(COPY) : COPY,
    muted: false,
    onResume: nothing,
    onQuit: nothing,
    onSettings: nothing,
    onMute: nothing,
    reconnect,
  })

const ESSENTIAL = ['resume', 'pause-mute', 'quit', 'settings']
layoutContract('pause', (locale) => mount(locale, false), ESSENTIAL)
layoutContract('pause (reconnect)', (locale) => mount(locale, true), ESSENTIAL)
