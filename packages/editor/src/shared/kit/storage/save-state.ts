/**
 * Where a project stands on saving, as the status line shows it: saved, edited since, being written, the last write
 * failed, or this device keeps nothing (OPFS is unavailable, so Export is the way to keep the work).
 */
export type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'device'
