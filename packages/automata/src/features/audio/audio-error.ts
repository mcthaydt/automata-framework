import { Data } from 'effect'
import type { TaggedErrorClass } from '../../shared/runtime/boot-error.js'

/** The fields of `AudioDecodeFailed`. */
export interface AudioDecodeFailedFields {
  /** The asset path the sound or music was asked for by. */
  readonly alias: string
  readonly cause: unknown
}
const AudioDecodeFailedBase: TaggedErrorClass<'AudioDecodeFailed', AudioDecodeFailedFields> =
  Data.TaggedError('AudioDecodeFailed')
/**
 * The browser could not decode a sound's bytes: that sound is silent and nothing else stops. The
 * `audio.decode.failed` fact carries the same alias.
 */
export class AudioDecodeFailed extends AudioDecodeFailedBase {}
