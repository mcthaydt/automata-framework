// A value's place in a content document: object keys and array indices from the root (editor suite spec §4.4). It is
// the same shape as the JSON scanner's `JsonPath`, and a TOML array of tables is indexed like any array.
export type KeyPath = readonly (string | number)[]

export const keyPathText = (keyPath: KeyPath): string => JSON.stringify(keyPath)
