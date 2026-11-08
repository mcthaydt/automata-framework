import { type OpenedSuitePorts, openSuitePorts } from '@automata/editor/suite'
import { CONTENT_SAMPLE_GAME } from './sample-game.ts'

// The ports the page with every editor opens: the checkout it is served on (`automata editor --app-dir`), as the other
// suite pages open it, or, when no editor server answers (the site's try-it page), the content sample, kept in this
// browser's private storage as the 2D page keeps its own, so a visitor's edits and levels are there after a reload.
// `sample` says so for the top bar.
export function openContentSuite(env: Parameters<typeof openSuitePorts>[0]): Promise<OpenedSuitePorts> {
  return openSuitePorts({ ...env, sample: CONTENT_SAMPLE_GAME })
}
