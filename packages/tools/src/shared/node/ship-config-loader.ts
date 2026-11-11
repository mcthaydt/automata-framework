import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context, Data, Effect, Layer } from 'effect'
import type { ShipConfig } from '../ship/config/ship-config.ts'
import type { TaggedErrorClass } from './errors.ts'

// How a command reads a game's `ship.config.ts`. Production imports the file, as `automata ship` does; a test gives
// a value, so nothing here needs a game on disk.

const ShipConfigErrorBase: TaggedErrorClass<
  'ShipConfigError',
  { readonly path: string; readonly cause: unknown }
> = Data.TaggedError('ShipConfigError')

/** `ship.config.ts` could not be read: it is missing, or importing it threw. */
export class ShipConfigError extends ShipConfigErrorBase {
  override get message(): string {
    const why = this.cause instanceof Error ? this.cause.message : String(this.cause)
    return `could not read ${this.path}: ${why}`
  }
}

/** What the loader does. */
export interface ShipConfigLoaderService {
  /** The game's config: the default export of `<gameDir>/ship.config.ts`. */
  load(gameDir: string): Effect.Effect<ShipConfig, ShipConfigError>
}

/** The tag, as `Files` is: an identity interface and a generic tag, for isolatedDeclarations. */
export interface ShipConfigLoader {
  readonly _ShipConfigLoader: unique symbol
}
export const ShipConfigLoader: Context.Tag<ShipConfigLoader, ShipConfigLoaderService> = Context.GenericTag<
  ShipConfigLoader,
  ShipConfigLoaderService
>('@automata/tools/ShipConfigLoader')

/** The loader on a real import of `ship.config.ts`. */
export const ShipConfigLoaderLive: Layer.Layer<ShipConfigLoader> = Layer.succeed(ShipConfigLoader, {
  load: (gameDir) => {
    const path = resolve(gameDir, 'ship.config.ts')
    return Effect.tryPromise({
      try: async () => ((await import(pathToFileURL(path).href)) as { default: ShipConfig }).default,
      catch: (cause) => new ShipConfigError({ path, cause }),
    })
  },
})
