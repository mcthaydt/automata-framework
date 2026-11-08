// Feel's session: the game's feel file, and which feel is chosen (an entry's index, or `'limits'` for the "Never more
// than" page).
import type { FeelContent } from '@automata/feel'
import { ContentSession } from '../../shared/content-session.svelte.ts'
import type { TomlSession } from '../../shared/toml-session.ts'

export class FeelSession extends ContentSession<FeelContent, number | 'limits'> {
  constructor(toml: TomlSession<FeelContent>) {
    super(toml, 0, 'Start a feel file')
  }
}
