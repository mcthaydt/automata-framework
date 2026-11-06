// The picker's lists: filtering by what was typed and grouping under headings. Pure.

export interface PickerOption {
  readonly id: string
  readonly label: string
  /** Smaller text beside the label; searched too. */
  readonly detail?: string | undefined
  /** The heading it sits under. */
  readonly group?: string | undefined
  readonly disabled?: boolean | undefined
  readonly reason?: string | undefined
}

export interface PickerGroup {
  /** `undefined` for the options that belong to no group. */
  readonly heading: string | undefined
  readonly options: readonly PickerOption[]
}

/** The options whose label or detail contains `query`, ignoring case and the space around it; same order. */
export function filterOptions(options: readonly PickerOption[], query: string): readonly PickerOption[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return options
  return options.filter(
    (option) =>
      option.label.toLowerCase().includes(needle) || (option.detail?.toLowerCase().includes(needle) ?? false),
  )
}

/** Groups in the order each first appears; inside a group the options keep their order. */
export function groupOptions(options: readonly PickerOption[]): readonly PickerGroup[] {
  const groups = new Map<string | undefined, PickerOption[]>()
  for (const option of options) {
    const members = groups.get(option.group)
    if (members) members.push(option)
    else groups.set(option.group, [option])
  }
  return [...groups].map(([heading, members]) => ({ heading, options: members }))
}
