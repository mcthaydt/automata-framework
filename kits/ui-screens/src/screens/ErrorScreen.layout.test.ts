import '@mcthaydt/automata-ui/theme.css'
import { mountFixture } from '@mcthaydt/automata-testing'
import { type Locale, layoutContract, say } from '../testing/layout-sweep'
import ErrorScreen from './ErrorScreen.svelte'

// The error screen's contract: the message may scroll but the actions and Back always stay on screen and hittable.
const nothing = (): void => {}
const MESSAGE =
  'The save could not be written to this device. Free some space and try again, or keep playing without saving. Your progress since the last save may be lost.'

const mount = (locale: Locale, final: boolean) =>
  mountFixture(ErrorScreen, {
    title: say(locale, 'Moss Garden'),
    code: 'save-failed',
    message: say(locale, MESSAGE),
    actions: final
      ? []
      : [
          { id: 'retry', label: say(locale, 'Try again'), kind: 'primary', onSelect: nothing },
          { id: 'skip', label: say(locale, 'Continue without saving'), kind: 'secondary', onSelect: nothing },
        ],
    final,
    onBack: nothing,
    backLabel: say(locale, 'Back'),
  })

layoutContract('error', (locale) => mount(locale, false), ['error-retry', 'error-skip'])
layoutContract('error (final)', (locale) => mount(locale, true), [])
