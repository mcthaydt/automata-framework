/**
 * The shape of `tokens.json`, the one source of the look the editor and the website share. `tokens.css` is
 * generated from it (`tokensToCss`) and both import that file.
 */
export interface EditorTokens {
  /** `color-scheme` of the page. The look is light only; a dark theme would be a second token set. */
  readonly colorScheme: 'light' | 'dark'
  /** Custom property name, without `--`, to its CSS value, used verbatim. Written in this order. */
  readonly tokens: Readonly<Record<string, string>>
  /** Old name, without `--`, to the token it now means: written as `--old: var(--token);` after the tokens. */
  readonly aliases: Readonly<Record<string, string>>
}
