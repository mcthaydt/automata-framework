import { settle } from '@ruken/sdk-host/testing'
import { describeHostingContract } from '#src/testing/host/contract-suite.ts'
import { openHostingTest } from '#src/testing/host/page/index.ts'

// PUB-a and DIST-c: the contract cases every adapter passes, on the Ruken adapter over the fake Ruken host (the web
// adapter's run is in `web/hosting-web.test.ts`). The fake host's own session is released with `Hosting`.
describeHostingContract(
  'the Ruken adapter over the fake Ruken host',
  async () => {
    const opened = await openHostingTest()
    if (!opened.ok) throw new Error('the fake host refused')
    // Disposing `Hosting` (each contract case does) must also close the fake host behind it.
    const { hosting, dispose } = opened.value
    return { ...hosting, dispose }
  },
  () => settle(),
)
