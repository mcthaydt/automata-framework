/**
 * The shape of `tokens.json`, the one source of the look the editor and the website share. `tokens.css` is
 * generated from it (`tokensToCss`) and both import that file.
 */
export interface EditorTokens {
  /** `color-scheme` of the page, the website's: light. The editors' dark look is `tool-theme.json` (`ToolTheme`). */
  readonly colorScheme: 'light' | 'dark'
  /** Custom property name, without `--`, to its CSS value, used verbatim. Written in this order. */
  readonly tokens: Readonly<Record<string, string>>
  /** Old name, without `--`, to the token it now means: written as `--old: var(--token);` after the tokens. */
  readonly aliases: Readonly<Record<string, string>>
}

/**
 * The shape of `tool-theme.json`: the editors' colours in each look, the same names in both. `tool-theme.css` is
 * generated from it (`toolThemeToCss`); the editors import it, the website does not.
 */
export interface ToolTheme {
  /** Custom property name, without `--`, to a plain colour, in the light look (today's). */
  readonly light: Readonly<Record<string, string>>
  /** The same names in the dark look. */
  readonly dark: Readonly<Record<string, string>>
}
