import { settle } from '@ruken/sdk-host/testing'
import { Effect } from 'effect'
import { describeHostingContract } from '#src/contract-suite.ts'
import { HostingTest } from '#src/testing/index.ts'

// PUB-a and DIST-c: the contract cases every adapter passes, on the Ruken adapter over the fake Ruken host (the web
// adapter's run is in `web/hosting-web.test.ts`).
describeHostingContract(
  'the Ruken adapter over the fake Ruken host',
  () => HostingTest(),
  Effect.promise(() => settle()),
)
