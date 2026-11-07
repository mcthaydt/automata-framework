/**
 * The sim package's version, written into replay headers for information only. A constant
 * rather than a build-time define, so workspace tests and un-built replays carry the real version; the release's
 * version step updates it with package.json, and version.test.ts keeps the two equal.
 */
export const SIM_VERSION: string = '0.0.5'
