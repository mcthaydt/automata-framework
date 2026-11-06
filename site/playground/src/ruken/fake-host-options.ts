import type { createFakeHost } from '@ruken/sdk-host/testing'
import type { HostSettings } from '@mcthaydt/examples-runner/header'

type FakeHostCreateOptions = Parameters<typeof createFakeHost>[0]
type Capability = NonNullable<FakeHostCreateOptions['grant']>[number]

/** What a playground frame hands Ruken's fake host for an example's `Host:` header. */
export interface PlaygroundHostOptions {
  readonly create: Pick<FakeHostCreateOptions, 'grant' | 'saves'>
  /** The saves server and the leaderboards are unreachable. */
  readonly offline: boolean
}

/** The fake host's settings for an example: each field the header leaves out keeps the fake host's default. */
export function fakeHostOptions(settings: HostSettings | undefined): PlaygroundHostOptions {
  return {
    create: {
      ...(settings?.grant === undefined ? {} : { grant: settings.grant as Capability[] }),
      ...(settings?.saves === undefined ? {} : { saves: { ...settings.saves } }),
    },
    offline: settings?.offline === true,
  }
}
