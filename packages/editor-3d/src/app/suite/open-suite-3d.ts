import { type OpenedSuitePorts, openSuitePorts, samplePorts } from '@automata/editor/suite'
import { SAMPLE_3D } from './sample-3d.ts'

// The ports the full suite page opens: the checkout it is served on, as the 2D page opens it, or, when no editor server
// answers (the site's try-it page), the 3D sample held in memory, and `sample` says so for the top bar.
export async function openSuite3d(env: Parameters<typeof openSuitePorts>[0]): Promise<OpenedSuitePorts> {
  const opened = await openSuitePorts(env)
  return opened.sample ? { ...opened, ports: await samplePorts(SAMPLE_3D) } : opened
}
