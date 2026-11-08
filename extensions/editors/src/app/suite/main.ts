// Pixi's WebGL renderer compiles its shaders with eval unless this runs first (Levels 2D, Levels 3D and the Studio draw
// with it).
import '@automata/framework/no-eval'
import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '@automata/editor/suite.css'
import type { SuiteEditor } from '@automata/editor/kit/ports'
import {
  browserPublish,
  createDownloadStore,
  createLevels2d,
  createSuite,
  createTuner,
  randomIds,
  startSuite,
} from '@automata/editor/suite'
import { GamesPage } from '@automata/editor/web-games'
import { editors3d } from '@automata/editor-3d/suite'
import { mount } from 'svelte'
import { browserAudio } from '../../features/audio/audio-output.ts'
import { browserOutputs } from '../../features/feel/feel-stage.ts'
import { contentEditors } from './content-editors.ts'
import { type ContentPage, openContentPage } from './open-content-page.ts'
import { startingFiles } from './starting-files.ts'

// The page with every editor, which `automata editor` serves every game and the site's try-it page opens: the core
// editors (the Tuner, Levels 2D), Levels 3D and the Studio, then Feel, Audio, Writer, Sequence and Schematic. The rail
// shows every one of them except those for another kind of game (a 2D game has no Levels 3D), whether or not the game
// has their files yet: an editor without files opens on a page that offers to start one. The only file that reaches for
// the page's globals. It opens the game it is served on (its content, its
// Play and its Publish); with no editor server it opens a sample game held in memory and says so in the top bar.

const target = document.getElementById('app')
if (target === null) throw new Error('suite.html has no #app element')
const root: HTMLElement = target

function saveFile(name: string, bytes: Uint8Array): void {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' }))
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

/** Every editor, over the ports of the game opened (served, the sample, or the person's own in this browser). */
function startEditors(page: Extract<ContentPage, { opened: unknown }>): Promise<unknown> {
  const { ports, sample, kept, gameUrl, playOff, game, publish, where } = page.opened
  const own = page.kind === 'game'
  // The Tuner shows the game's dev page beside its settings, so it is made once the server has named it.
  const editors = [
    createTuner({ gameUrl }),
    createLevels2d({
      // The sample and the person's own games have no folder on disk to keep a level in, so a level starts from a
      // template and the result is kept with the game.
      templates: sample || own ? 'content/levels' : undefined,
      share: sample ? createDownloadStore() : undefined,
      ids: randomIds((bytes) => crypto.getRandomValues(bytes)),
      objectUrls: {
        create: (bytes) => URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>])),
        revoke: (url) => URL.revokeObjectURL(url),
      },
    }),
    ...editors3d(window),
    ...contentEditors({
      audio: browserAudio(() => new AudioContext()),
      outputs: browserOutputs(),
      gameUrl,
    }),
  ]
  return startSuite(root, {
    window,
    document,
    ports,
    suite: createSuite({ editors: editors as SuiteEditor<unknown>[] }),
    sample,
    kept,
    game,
    playUrl: gameUrl,
    playOff,
    publish: publish === undefined ? undefined : browserPublish(publish, document),
    ...(page.kind === 'game'
      ? {
          gameKey: page.game.id,
          where,
          initialEditor: page.editor,
          // What was open is where the game opens next time; a change is a change to the game, so it moves up the list.
          onEditor: (id: string | undefined) => {
            void page.games.remember(page.game.id, id)
          },
        }
      : {}),
  })
}

const navigate = (search: string): void => location.assign(`${location.pathname}${search}`)

openContentPage({ origin: location.origin, search: location.search, sessionStorage, now: () => Date.now() })
  .then((page) => {
    if (page.kind === 'games' || page.kind === 'new')
      return mount(GamesPage, {
        target: root,
        props: {
          games: page.games,
          mode: page.kind === 'games' ? 'list' : 'new',
          starter: () => startingFiles(page.kind === 'new' ? page.startingPoint : '2d'),
          navigate,
          save: saveFile,
          now: () => Date.now(),
        },
      })
    return startEditors(page)
  })
  .catch((error: unknown) => {
    root.textContent = `The editors could not start: ${error instanceof Error ? error.message : String(error)}`
  })
