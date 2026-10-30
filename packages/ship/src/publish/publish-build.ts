import type { Files, ProcessRunner } from '@mcthaydt/automata-node'
import { Effect } from 'effect'
import type { ShipConfig } from '../config/ship-config.ts'
import { PrivatePublishNotLocal } from '../errors.ts'
import { type PrepareError, prepareBuild } from '../prepare/prepare-build.ts'
import { type PublishError, type PublishInput, publishToRuken } from './publish-to-ruken.ts'

/** What `publishBuild` needs: `publishToRuken`'s input, the game's ship config, the release tag and the audience. */
export interface PublishBuildInput extends PublishInput {
  readonly config: ShipConfig
  readonly tag?: string | undefined
  /**
   * A private upload, to Ruken's local stack only: the build may contain `@pixi/3d`, a closed beta (D-1, M3 spec
   * §4.8). Refused unless `api` is a loopback or `.localhost` host.
   */
  readonly private?: boolean | undefined
}

/** Whether `api` is Ruken's local stack: `localhost`, a `.localhost` name, or a loopback address. */
export function isLocalStack(api: string): boolean {
  let host: string
  try {
    host = new URL(api).hostname
  } catch {
    return false
  }
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '[::1]' ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
  )
}

/**
 * `ship publish` for Ruken (ship spec §3.4): prepare the build, then hand it to Ruken's own CLI. A public publish
 * (the default) refuses a build that contains `@pixi/3d` (X-b). A private one prepares with the closed beta allowed
 * and uploads only to Ruken's local stack, checked before anything is prepared, so the beta never reaches a public
 * Ruken through ship.
 */
export function publishBuild(
  input: PublishBuildInput,
): Effect.Effect<
  { url: string | undefined },
  PrepareError | PublishError | PrivatePublishNotLocal,
  Files | ProcessRunner
> {
  return Effect.gen(function* () {
    if (input.private === true && !isLocalStack(input.api))
      return yield* new PrivatePublishNotLocal({ api: input.api })
    yield* prepareBuild({
      distDir: input.distDir,
      gameDir: input.cwd,
      config: input.config,
      tag: input.tag,
      audience: input.private === true ? 'private' : 'public',
    })
    return yield* publishToRuken(input)
  })
}
