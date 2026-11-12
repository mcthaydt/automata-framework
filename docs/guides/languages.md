# Languages

How a game speaks more than one language: where its words live, how `automata words` has an AI translate them, and
what `automata check` holds you to.

Every game made with `create-game` ships six languages: English (the one the words are written in), 日本語, 한국어,
Español (Latin America), Português (Brasil) and 简体中文. The framework's own menus, the settings, the pause screen and
the first-run screens are already translated in all six, so a new game has nothing to do to get them.

## What a game says

The words a game shows are *catalogs*: one JSON file per language, a key to a text, with `{name}` wherever the text
needs a name or a number.

| Catalog | Where | What it holds |
|---|---|---|
| content | `content/messages/<language>.json` | text written in your content files (a Feel word, a name), translated |
| ui | `messages/ui/<language>.json` | the words of your own screens |
| achievements | `messages/achievements/<language>.json` | each achievement's title and description, made from `ship.config.ts` |

English comes from where you write it (the content files, `messages/ui/en.json`, `ship.config.ts`); the other
languages are the files beside it. The languages a game offers are the ones it lists in `locale` in `defineGame`:

```ts
locale: { locales: ['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans'], baseLocale: 'en' },
```

Core's `DEFAULT_LOCALES` is that same list, so `locale: { locales: [...DEFAULT_LOCALES], baseLocale: 'en' }` says the
six. A player picks in Settings, and the choice is kept. On a first visit the game asks (see
[How it works](./how-it-works.md#the-first-run)); on Ruken the player's own language is used.

The runtime's own words (loading, a failed download, the lost-picture panel, the rotate hint) follow that language too,
and change with it. Before anything is saved they are in the browser's language; once the host and the saved choice are
known, in theirs. To reword them yourself, `defineGame({ copy: { loading: '…', contextLost: '…' } })` words them in every
language, and `copy: (locale) => ({ loading: … })` words them for each (`screens`, the default screens' words, may sit
inside either).

## Have an AI translate: `automata words`

```sh
pnpm exec automata words
```

It reads each catalog, finds the words that have **no translation yet** (missing) and the words whose English
**changed** since they were translated (stale), has a model translate those into every language the game ships, and
writes the files. It leaves the rest alone, so running it again costs nothing.

It needs a key on your computer: `AUTOMATA_ANTHROPIC_KEY` if that is set, otherwise `ANTHROPIC_API_KEY`. It reads the
environment and nothing else, sends the key to Anthropic's API and nowhere else, and never prints it. To keep the key out of
a shell that other programs read, set it for the one command: `AUTOMATA_ANTHROPIC_KEY=… pnpm exec automata words`. If the key
is turned down, the service is busy or over its limit, or it cannot be reached, the run stops at the first answer instead of
asking for every word, keeps what it had translated and says what to do; a busy answer is first asked again a few times,
waiting longer each time. A word the model declines is only that word's problem, and the run goes on.

```sh
pnpm exec automata words title_play        # one line, in every language
pnpm exec automata words --to ja           # every missing or stale word, into Japanese only
pnpm exec automata words --all             # every word again, even those with a translation
pnpm exec automata words --mark            # translate nothing; say the translations written by hand match the English now
```

How "stale" is known: next to the catalogs, `words-sources.json` records the English each translation was made from.
Change an English word and its translations are stale until `automata words` (or you, then `--mark`) writes them again.
A `{name}` in the English must be in every translation, and nothing else may be: the check below holds the placeholders.

A translation is just a file, so a person can open it and change a word by hand. There is no review step and no
approval to record: a word is missing, stale, or it is there.

## Fonts: every language is drawn

A game's font has to draw every language it ships; no language falls back to the player's device. `create-game` puts the
pixel font (Fusion Pixel, in one flavour for each script) in `assets/fonts/` with `content/fonts.toml` naming it.
`automata-content assets` cuts it to the characters your words use and writes `fonts.css`, which `src/main.ts` imports; the
page's `lang` picks the face. A new word with a character the font lacks is an error from `automata check`, not a box on
a player's screen. To use another font, list it in `content/fonts.toml` with the languages it serves; each language needs
a face.

## What `automata check` says

```sh
pnpm check
```

(`pnpm check` cuts the fonts first, because the check builds the game. `pnpm exec automata check --only words` runs just
this step.)

- a **missing** word, in a language the game ships, in any catalog;
- a **lost placeholder**: a translation with a `{name}` the English does not have, or without one it does;
- a **character the font cannot draw**, naming the word and the character.

The achievements' words have their own step, `--only achievements`: it says when `messages/achievements/en.json` is missing or
behind `ship.config.ts` (run `automata words` to write it). Run `automata check` before you ship.
