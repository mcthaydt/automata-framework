import { type OpenedSuitePorts, openSuitePorts, samplePorts } from '@automata/editor/suite'
import { CONTENT_SAMPLE_GAME } from './sample-game.ts'

// The ports the content editors' page opens: the checkout it is served on (`automata editor --app-dir`), as the other
// suite pages open it, or, when no editor server answers (the site's try-it page), the content sample held in memory,
// and `sample` says so for the top bar.
export async function openContentSuite(env: Parameters<typeof openSuitePorts>[0]): Promise<OpenedSuitePorts> {
  const opened = await openSuitePorts(env)
  return opened.sample ? { ...opened, ports: await samplePorts(CONTENT_SAMPLE_GAME) } : opened
}
