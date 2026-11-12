---
'@automata/tools': patch
---
`automata create-game` makes a game that sounds and speaks like the framework's own: its buttons play starter sounds (`ui.press`, `ui.back` and `ui.focus`, cues in `content/audio/audio.toml` that the Audio editor changes, mapped by `uiSounds` in `src/app/feel-audio.ts`), it ships in the six default languages with a catalog for each, and it draws them in the Fusion Pixel font set copied into `assets/fonts/` with its licence and named in `content/fonts.toml`. `pnpm dev` and every build cut the fonts first (`automata-content assets`, from the new `automata.content.ts`), and the page draws in `var(--af-font)`. The 3D template is unchanged.
