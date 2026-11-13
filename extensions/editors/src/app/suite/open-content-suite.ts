import { type OpenedSuitePorts, openSuitePorts } from '@automata/editor/suite'
import { CONTENT_SAMPLE_GAME } from './sample-game.ts'

// The ports the content editors' page opens: the checkout it is served on (`automata editor --app-dir`), as the other
// suite pages open it, or, when no editor server answers (the site's try-it page), the content sample kept in this
// browser's private storage, and `sample` says so for the top bar. The saved line says "Saved on this device" only when
// the sample really is kept there, so the sample's files go through the same opener as the checkout's (a sample held
// in memory beside it would say the words are kept when a reload loses them).
export function openContentSuite(env: Parameters<typeof openSuitePorts>[0]): Promise<OpenedSuitePorts> {
  return openSuitePorts({ ...env, sample: CONTENT_SAMPLE_GAME })
}
