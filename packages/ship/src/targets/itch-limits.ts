// itch.io's documented limits for an HTML5 ZIP upload, in the one place AF keeps them (ADR 0005: itch.io
// publishes no package, so its facts live in a single AF file that cites the page and the date it was read).
//
// From "The ZIP file should not contain more than 1,000 individual files after extraction. The maximum length
// of a file name including path should not be greater than 240 characters long. The size of all the extracted
// content should not be greater than 500MB. The size any single extracted file should not be greater than
// 200MB. The filenames are case sensitive".
//
// "MB" is read as 1,000,000 bytes, the stricter of the two readings, so a build that passes here cannot be
// refused for being a few MiB over.

export const ITCH_LIMITS_SOURCE: { readonly url: string; readonly read: string } = {
  url: 'https://itch.io/docs/creators/html5',
  read: '2026-10-16',
}

export const ITCH_LIMITS: {
  readonly maxFiles: number
  readonly maxPathLength: number
  readonly maxFileBytes: number
  readonly maxTotalBytes: number
} = {
  maxFiles: 1000,
  maxPathLength: 240,
  maxFileBytes: 200_000_000,
  maxTotalBytes: 500_000_000,
}
