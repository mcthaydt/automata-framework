/** The fields of `AudioDecodeFailed`. */
export interface AudioDecodeFailedFields {
  /** The asset path the sound or music was asked for by. */
  readonly alias: string
  readonly cause: unknown
}

/**
 * The browser could not decode a sound's bytes: that sound is silent and nothing else stops. The
 * `audio.decode.failed` fact carries the same alias.
 */
export class AudioDecodeFailed extends Error {
  readonly _tag = 'AudioDecodeFailed' as const
  readonly alias: string

  constructor(fields: AudioDecodeFailedFields) {
    super(`audio: '${fields.alias}' could not be decoded`, { cause: fields.cause })
    this.name = 'AudioDecodeFailed'
    this.alias = fields.alias
  }
}
