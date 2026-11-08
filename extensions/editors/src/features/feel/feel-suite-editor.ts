// Feel as a suite editor: `feel` in the editor list. It opens the first feel file the list hands it (a game has one,
// `content/feel/feel.toml`, and the editor makes it when there is none) and keeps it for the app's life.

import type { AudioContent } from '@automata/audio-synth'
import { defineSuiteEditor, type SuiteEditor } from '@automata/editor/kit/ports'
import { type FeelContent, feelSchema } from '@automata/feel'
import type { AudioPlay } from '../../shared/audio-play.ts'
import { audioCues, audioFileWith, gameEvents } from '../../shared/game-events.ts'
import { undoOf } from '../../shared/session-hooks.ts'
import { openTomlSession } from '../../shared/toml-session.ts'
import { canvas, panel, status } from './FeelRegions.svelte'
import { FeelSession } from './feel-session.svelte.ts'
import type { StageOutputs } from './feel-stage.ts'

/** Where a game's feel file goes when it has none. */
export const FEEL_PATH = 'content/feel/feel.toml'

const EMPTY = '# What the player feels when something happens in the game.\n'

export interface FeelOptions {
  readonly outputs?: StageOutputs
  /** How the page makes the game's sounds (the Audio editor's player). Without it the stage says what it would play. */
  readonly audio?: AudioPlay
}

export function createFeel(options: FeelOptions = {}): SuiteEditor<FeelSession> {
  return defineSuiteEditor<FeelSession>({
    id: 'feel',
    label: 'Feel',
    icon: 'list',
    hue: 'color/ed/feel',
    async open(files, ports) {
      const play = options.audio
      const path = files.find((file) => file.path.endsWith('.toml'))?.path ?? FEEL_PATH
      const toml = await openTomlSession<FeelContent>({
        path,
        ports,
        schema: feelSchema,
        empty: EMPTY,
        editor: 'feel',
      })
      return new FeelSession(toml, {
        events: await gameEvents(ports.workspace),
        cues: await audioCues(ports.workspace),
        ...(options.outputs === undefined ? {} : { outputs: options.outputs }),
        ...(play === undefined
          ? {}
          : {
              // The sound is read from the game's file as it is now, so a sound just made in Audio plays at once.
              play: (id: string) => {
                void audioFileWith(ports.workspace, id)
                  .then((file) =>
                    file === undefined ? undefined : play(file as AudioContent, { kind: 'sound', id }),
                  )
                  .catch(() => undefined)
              },
            }),
      })
    },
    regions: { panel, canvas, status },
    undo: (session) => undoOf(session.toml),
  })
}
