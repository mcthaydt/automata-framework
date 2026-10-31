import type { TaggedErrorClass } from '@mcthaydt/automata-node'
import { Data } from 'effect'

// The desktop target's failures (DIST spec §6.2), re-exported by `errors.ts` with every other ship error.

const TauriBuildInvalidBase: TaggedErrorClass<'TauriBuildInvalid', { readonly problems: readonly string[] }> =
  Data.TaggedError('TauriBuildInvalid')
/** The config or the web build is not ready for a desktop build; each problem says what to change. */
export class TauriBuildInvalid extends TauriBuildInvalidBase {
  override get message(): string {
    return `the build is not ready for the desktop:\n${this.problems.join('\n')}`
  }
}

const TauriToolchainMissingBase: TaggedErrorClass<
  'TauriToolchainMissing',
  { readonly missing: 'cargo' | 'webkit2gtk-4.1' | 'tauri'; readonly message: string }
> = Data.TaggedError('TauriToolchainMissing')
/** A tool the desktop build needs is not installed; found before anything is written. */
export class TauriToolchainMissing extends TauriToolchainMissingBase {}

const TauriBuildFailedBase: TaggedErrorClass<
  'TauriBuildFailed',
  { readonly exitCode: number; readonly stderr: string }
> = Data.TaggedError('TauriBuildFailed')
/** `tauri build` exited with an error; its output was shown as it ran. */
export class TauriBuildFailed extends TauriBuildFailedBase {
  override get message(): string {
    return `tauri build failed with exit code ${this.exitCode}${this.stderr === '' ? '' : `:\n${this.stderr.trim()}`}`
  }
}
