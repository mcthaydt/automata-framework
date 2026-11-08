import type { Command, CommandRegistry } from '../commands/command'
import { parseShortcut, type Shortcut } from '../commands/shortcut'

export type Platform = 'apple' | 'other'

/**
 * What the keymap needs to know about a key press, so it stays free of the DOM: the app turns a `KeyboardEvent`
 * into this and sets `inText` from its target (an input, a textarea, a select or an editable element).
 */
export interface KeyInput {
  /** `KeyboardEvent.key`. */
  readonly key: string
  readonly metaKey: boolean
  readonly ctrlKey: boolean
  readonly shiftKey: boolean
  readonly altKey: boolean
  /** Focus is in a text field. */
  readonly inText: boolean
}

export interface Keymap {
  /** The command a key press would run now, or none. */
  resolve(input: KeyInput): Command | undefined
  /** Runs it. True means a command ran, so the caller should `preventDefault`. */
  handle(input: KeyInput): boolean
}

function matches(shortcut: Shortcut, input: KeyInput, platform: Platform): boolean {
  const apple = platform === 'apple'
  return (
    input.key.toLowerCase() === shortcut.key &&
    input.metaKey === (shortcut.meta || (shortcut.mod && apple)) &&
    input.ctrlKey === (shortcut.ctrl || (shortcut.mod && !apple)) &&
    input.shiftKey === shortcut.shift &&
    input.altKey === shortcut.alt
  )
}

/**
 * Looks shortcuts up in the registry on every key press, so commands registered or removed later are followed.
 * Modifiers must match exactly, and `Mod` is Meta on Apple platforms and Ctrl elsewhere. A command that is
 * disabled, or that would fire while the player is typing without `allowInText`, is not resolved: its key
 * falls through to the browser.
 */
export function createKeymap(registry: CommandRegistry, platform: Platform): Keymap {
  const resolve = (input: KeyInput): Command | undefined =>
    registry.list().find((command) => {
      if (command.shortcut === undefined) return false
      if (input.inText && command.allowInText !== true) return false
      if (command.enabled?.() === false) return false
      return matches(parseShortcut(command.shortcut), input, platform)
    })

  return {
    resolve,
    handle(input) {
      const command = resolve(input)
      if (command === undefined) return false
      command.run()
      return true
    },
  }
}
