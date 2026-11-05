/** Bytes that are not a valid `.replay`. `offset` is the byte where reading failed, when known. */
export class ReplayFormatError extends Error {
  readonly offset: number | undefined
  constructor(message: string, offset?: number, options?: ErrorOptions) {
    super(
      offset === undefined ? `replay format: ${message}` : `replay format: ${message} at byte ${offset}`,
      options,
    )
    this.name = 'ReplayFormatError'
    this.offset = offset
  }
}

/** A recording that cannot be exact: the sim stepped outside the recorder, a payload that is not JSON, and so on. */
export class ReplayRecordError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(`replay recording: ${message}`, options)
    this.name = 'ReplayRecordError'
  }
}
