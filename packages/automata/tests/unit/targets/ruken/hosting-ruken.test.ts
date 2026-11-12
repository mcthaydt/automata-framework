import { settle } from '@ruken/sdk-host/testing'
import { describeHostingContract } from '#src/testing/host/contract-suite.ts'
import { type HostingTestSession, openHostingTest } from '#src/testing/host/page/index.ts'

// PUB-a and DIST-c: the contract cases every adapter passes, on the Ruken adapter over the fake Ruken host (the web
// adapter's run is in `web/hosting-web.test.ts`). The fake host's own session is released with `Hosting`.
/** A fresh session. Disposing `Hosting` (each contract case does) must also close the fake host behind it. */
async function open(
  options: Parameters<typeof openHostingTest>[0] = {},
): Promise<{ hosting: HostingTestSession['hosting']; session: HostingTestSession }> {
  const opened = await openHostingTest(options)
  if (!opened.ok) throw new Error('the fake host refused')
  const { hosting, dispose } = opened.value
  return { hosting: { ...hosting, dispose }, session: opened.value }
}

// Ruken grants `links` when the game asks for it, and its fake host answers Cancel to a link unless told to open.
let linkSession: HostingTestSession | undefined
describeHostingContract(
  'the Ruken adapter over the fake Ruken host',
  async () => (await open()).hosting,
  () => settle(),
  {
    create: async () => {
      const made = await open({
        hosting: { wants: ['saves', 'links'] },
        host: { ui: { confirmExternalLink: async () => true } },
      })
      linkSession = made.session
      return made.hosting
    },
    createWithoutGrant: async () => {
      const made = await open({ host: { ui: { confirmExternalLink: async () => true } } })
      linkSession = made.session
      return made.hosting
    },
    opened: () =>
      linkSession?.handle.host.ui.callsTo('confirmExternalLink').map(([url]) => String(url)) ?? [],
    decline: () => {
      if (linkSession !== undefined)
        linkSession.handle.host.ui.responders.confirmExternalLink = async () => false
    },
  },
)
