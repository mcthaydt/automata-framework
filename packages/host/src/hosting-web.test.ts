import { settle } from '@ruken/sdk-host/testing'
import { Effect, Layer } from 'effect'
import { Hosting, type HostingOptions } from './hosting'
import { makeWebHosting, type WebTarget } from './hosting-web'
import { HostingTest } from './testing'
import { type FakeWebPage, type FakeWebPageOptions, fakeWebPage } from './testing/fake-web-page'
import { describeHostingContract } from './testing/hosting-contract'

const OPTIONS: HostingOptions = { gameId: 'blank-game', wants: ['saves'], pauseBehavior: 'pause' }

/** The web adapter over a fake page, as a layer; the page is returned so a test can drive it. */
function webHosting(pageOptions: FakeWebPageOptions = {}, target: WebTarget = 'web', hosting = OPTIONS) {
  const fake: FakeWebPage = fakeWebPage(pageOptions)
  return { fake, layer: Layer.scoped(Hosting, makeWebHosting(hosting, fake.page, target)) }
}

// PUB-a: the same contract cases on both adapters.
describeHostingContract(
  'the Ruken adapter over the fake Ruken host',
  () => HostingTest(),
  Effect.promise(() => settle()),
)
describeHostingContract('the web adapter over a page', () => webHosting().layer, Effect.void)
