// The `./hash` export: the sim's XXH64 and canonical JSON, shared with the content compiler so a
// content hash computed at build time equals the one the sim checks on restore (master spec §9).
export { canonicalJson, utf8 } from './canonical'
export { hex64, xxhash64 } from './xxhash64'
