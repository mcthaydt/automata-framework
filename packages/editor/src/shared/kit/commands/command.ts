import { normalizeShortcut } from './shortcut'

/**
 * Something the editor can do by name: from a menu, a toolbar button, a key or a gesture. It closes over the
 * editor's own state (its `History`, its `Selection`), so it takes no context.
 */
export interface Command {
  /** Stable and unique: `edit.undo`. */
  readonly id: string
  readonly title: string
  run(): void
  /** Asked each time, so a disabled command greys its button and lets its key fall through. Default: enabled. */
  enabled?(): boolean
  /** `Mod+Z`, `Mod+Shift+Z`, `Delete`, `Space`; see `parseShortcut`. */
  readonly shortcut?: string
  /** Fires while a text field has focus; by default a shortcut leaves typing alone. */
  readonly allowInText?: boolean
}

/** Checks a command's id, title and shortcut once, where it is written, and returns it. */
export function defineCommand(command: Command): Command {
  if (command.id.trim() === '') throw new Error('a command needs an id')
  if (command.title.trim() === '') throw new Error(`command "${command.id}" needs a title`)
  if (command.shortcut !== undefined) normalizeShortcut(command.shortcut)
  return command
}

export interface CommandRegistry {
  /** Throws on a duplicate id, or a shortcut another command has. Returns the way to take it out again. */
  register(command: Command): () => void
  get(id: string): Command | undefined
  /** In registration order. */
  list(): readonly Command[]
  /** Runs the command when it exists and is enabled; says whether it did. */
  run(id: string): boolean
}

export function createCommandRegistry(): CommandRegistry {
  const byId = new Map<string, Command>()
  const idByShortcut = new Map<string, string>()

  return {
    register(command) {
      if (byId.has(command.id)) throw new Error(`command "${command.id}" is already registered`)
      const shortcut = command.shortcut === undefined ? undefined : normalizeShortcut(command.shortcut)
      if (shortcut !== undefined) {
        const owner = idByShortcut.get(shortcut)
        if (owner !== undefined) {
          throw new Error(`command "${command.id}" cannot use ${shortcut}: "${owner}" already does`)
        }
        idByShortcut.set(shortcut, command.id)
      }
      byId.set(command.id, command)
      return () => {
        // Only this registration: a later command with the same id is not ours to remove.
        if (byId.get(command.id) !== command) return
        byId.delete(command.id)
        if (shortcut !== undefined) idByShortcut.delete(shortcut)
      }
    },
    get: (id) => byId.get(id),
    list: () => [...byId.values()],
    run(id) {
      const command = byId.get(id)
      if (command === undefined || command.enabled?.() === false) return false
      command.run()
      return true
    },
  }
}
