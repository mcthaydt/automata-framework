# Shared polish from FloorFifty: design

**Date:** 2026-11-11. **Status:** in force. The Owner said to begin (2026-11-11); the coordinator's calls at the end stay open to correction. **Stage:** 1 (spec).
**Tracker:** [`../progress.md`](../progress.md).

## Why

The framework and its editors exist so that games like The Last Light are easier to make and to change by hand. The
Owner wants every game on the framework to have FloorFifty's level of finish in the parts that are not about any one
game: languages, gamepad, responsive screens and the shell around play (2026-11-11: "the non-game specific things should
be standardized as they're shared").

An audit on 2026-11-11 compared FloorFifty (`SNEKPRTY/floorfifty` at `677d456`) with the framework (`5d7f40d3`). Almost
all of FloorFifty's shared layer is already in `packages/automata`. Seven things are not. This work adds them, with an
example for each one a person can see, so the site's Examples page shows them. The Last Light's port onto the framework
is the next spec and inherits all of this.

## Goals

1. Every game's menus (title, pause, settings, save slots, errors, prompts) are in six languages without the game
   doing anything.
2. One command, `automata words`, has an AI translate everything or one line, into one language or all; the build
   says when a language is missing a word or a font cannot draw one.
3. The first run of a game asks for a language, and warns about flashing where the game says it flashes.
4. Every button makes a sound by default.
5. A game gets a splash with its studio's logo and a credits panel from data.
6. A game's achievements reach Ruken from the same place its leaderboards do.
7. An online game tells a player their tab is out of date before they join.

## Non-goals

- Translating any game's own story or content. Emberwick and Ember Hall get their few words translated as the worked
  examples; The Last Light's lines are its own project.
- Achievements on `web`, `itch` or `tauri`. Those hosts have none; nothing is drawn or stored for them.
- A translation editor in the suite (the framework's gap doc leaves it for later; inlang reads the same files).
- The Last Light's port. Interface motion and streamed music, which the audit could not settle, are out too.

## Anti-goals

- A second copy of anything Ruken owns. Achievement limits and rule shapes come from `@ruken/manifest`, never retyped.
- A sound, a warning or a language screen a game cannot turn off or restyle.
- Code, words or art copied from FloorFifty. It is the reference for behaviour; everything here is written new.
- A touch target under 44 px or a screen that fails at phone size.

## Constraints

- The framework's `AGENTS.md`: the seven laws, feature folders and `pnpm boundaries`, tests first and in `tests/`,
  Zod only, phone first, the grandma test for copy, `pnpm format` and `pnpm check` before each commit.
- Core is small: a thing is core only if every target needs it or both reference games do. Each item below says
  where it lives and why.
- Published packages get a `patch` changeset. A changed export means `pnpm build`, `pnpm api-report --update` and
  `pnpm api-index --write`, committed.
- No subagents. Hosted CI has no runners: report what ran, in Chromium, and what is left for the Owner's machine.

## Approaches

Three ways to place the seven were considered.

- **A. All in core.** Simplest for a game, but it grows `packages/automata` with a splash, credits and a net check
  that not every game needs. Against the core rule.
- **B. All in one new extension** (`@automata/polish`). Keeps core small, but menu translations and the first-run
  step belong to core's own screens and flow; an extension would have to reach into them, which extensions may not do.
- **C. Each where its owner already is** (chosen). Words and the first-run flow go with core's screens; the ready-made
  screens go with `@automata/ui-screens`; achievements are declared host-neutral and mapped by each target's ship step; the stale-build check goes with
  `@automata/net`; `automata words` and the font check go with `@automata/tools`.

The Owner handed the placement to the coordinator; C is the coordinator's call.

## The design, item by item

The FloorFifty paths (under `apps/client/src/` unless they start elsewhere) are references: read them to learn how the
thing behaves, then write it new on the framework's own pieces. Nothing is copied from FloorFifty: no code, no
translations, no branding, no art (the Owner, 2026-11-11: "we shouldn't be copying directly anyway").

### 1. Six languages

**Languages:** `en` (source), `ja`, `ko`, `es-419`, `pt-BR`, `zh-Hans`, FloorFifty's six in its picker order, each named
in its own script (`i18n/locales.ts`). A browser's language is matched on its primary subtag; every Chinese tag lands on
Simplified and every Portuguese on Brazilian (`i18n/detect.ts`). The framework already negotiates a locale
(`features/locale/negotiate-locale.ts`); it takes these rules where it lacks them.

**Core's own words (core).** The default screens' copy (`app/screens/screens-copy.ts`, English today, overridable with
`copy.screens`) ships in all six. A game that sets a language gets translated menus with no work; `copy.screens` still
overrides any of it.

**Where the translations come from.** They are written new for the framework's own strings, in all five languages,
and shipped. There is no review state and no review round (the Owner, 2026-11-11: "I don't care about the review for
translations").

**`automata words`: the AI translates (`@automata/tools`, Node).** The Owner, 2026-11-11: "cut the translation
workflow, AI is capable", then "Create an automata words that translates everything or one line, to one language, or
all". There is no CSV, no export or import and no review state. One command writes the translations:

- `automata words`: every word that is missing or whose source changed, into every language the game ships.
- `automata words --to ja`: the same, into one language.
- `automata words <key>`: one line, into every language; with `--to`, into one.
- `--all` retranslates words that already have a translation.

It reads the source messages the content compiler already produces, asks a Claude model for each translation with the
key, the source text, the game's notes for translators and the words already chosen for that language (so a term stays
the same across lines), and writes `content/messages/<lang>.json`. Before it writes, each result passes the checks
below; one that fails is asked for again once and then reported, never written. It prints what it changed.

The model is called through one small port, so tests use a fake and never reach the network. The key comes from the
environment (`ANTHROPIC_API_KEY`) on the developer's machine only: never in the repository, never in a build, never at
run time. With no key the command says so in one sentence and changes nothing. The model is the latest capable Claude
model by default and can be set in the game's config.

Two checks join `automata check` so a gap cannot ship: a placeholder in the source must appear in each translation,
and the font check below. The compiler already checks that every translation has exactly the source's keys.

**Fonts (the Owner, 2026-11-11: "go with a font that supports those languages").** The plan audit found the chosen
font (Fusion Pixel, OFL 1.1) reserves its name, and a cut-down copy may not keep a reserved name: the font build
renames a subset's family when the font is marked so, and ships the copyright and licence text. A game's font must draw every
language it ships; no language falls back to whatever the device has. Emberwick's font (Pixelify Sans) has no Japanese,
Korean or Chinese, so the reference games and the template move to a font, or a matched set of fonts, that covers all
six, openly licensed, in the pixel style, and subset to the characters used so the download stays small.
`automata check` fails a language the game's fonts cannot draw.

**Reference games.** Emberwick and Ember Hall ship in the six, as the proof it works end to end.

### 2. First-run language pick (core)

On the first run, before the title, a game that ships more than one language shows one screen: the languages in their
own scripts, the detected one focused, one press to continue (`ui/components/LanguageFirst.svelte`,
`LanguagePicker.svelte`). The choice is saved like the Settings choice and the screen never shows again. A game with one
language never sees it. A host that supplies a locale (Ruken) is taken at its word and the screen is skipped. It works
by keyboard, pad and touch at phone size.

### 3. Photosensitivity warning (core)

A game opts in from `defineGame` (the builder names the field beside the existing options). When on, the first run
shows a warning before anything flashes: what the game does, and the switches that reduce it, which are the settings
the game already has for effects (core's reduced-motion and, when the game has `@automata/feel`, its strength setting).
Continue, Close and Escape all go on. It is shown once per device (`ui/components/PhotosensitivityWarning.svelte`; the
`seen` flag in `common/settings.ts`).

**First-run order:** language, then the warning, then the splash, then the title.

### 4. Interface sounds (core)

One listener at the root of the overlay, so every control sounds without wiring (`ui/ui-sounds.ts`). A control says
otherwise with an attribute: `data-sfx="back"` for leaving or cancelling, `data-sfx="none"` where the consequence is its
own sound, and a game may add names. Moving focus has its own quiet sound. The names map to sounds in the game's
content, through the event-sound table core already has (`features/audio/event-sounds.ts`); they play on the interface
bus and obey its volume and mute. A game that maps nothing is silent, so no existing game changes. `create-game`'s
template maps a starter set from `@automata/audio-synth`, which the Audio editor can change.

### 5. Splash and credits (`@automata/ui-screens`)

`ui-screens` already holds Title, Results, Loading and Error; it gains two.
- **Splash:** the studio's logo (an image the game supplies), held briefly, skippable by any press, never blocking a
  host's ready signal (`ui/components/SplashRoot.svelte`, `StudioLogo.svelte`).
- **Credits:** a scrolling panel drawn from a content file of sections, names and links, with links routed through the
  host (`ui/components/CreditsPanel.svelte`, `common/credits.ts`). Reached from the title, or wherever the game places
  it; core's Settings gains no dependency on `ui-screens`.

Both take their words from copy records in the six languages, like core's screens.

**Opening a link (core's host contract).** The framework names a `links` capability but its `Hosting` service has no
call to open one, so a game cannot send a player to a web page the way its host wants. FloorFifty's host has it
(`ruken/host.ts` `openLink`, over the Ruken SDK's `links.open`), and the SDK the framework vendors already has
`links.open`, so nothing has to be asked of Ruken. This work adds the call to `Hosting` and to every target's adapter:
Ruken through its SDK, the web and itch in a new tab, the desktop in the system browser. A host that refuses says so;
the game never navigates away on its own. The credits panel is its first user.

### 6. Achievements (generic; declared in the game, mapped by each target)

The Owner, 2026-11-11: "keep achievements generic". An achievement is the framework's own idea, not Ruken's: a game
declares each one beside its leaderboards with an id, a title, a description and one goal on a board's score (reach a
value, or stand in a top share of players). The declaration is validated by the framework's own Zod schema and names
no host. Each target then does what its host can:

- **Ruken** awards achievements from rules in the manifest, so the Ruken ship step writes the declarations into
  `ruken.toml` (`shared/ship/targets/ruken/ruken-toml.ts` writes `[leaderboards.*]` today) and checks the result with
  `@ruken/manifest`'s own parser, reporting its errors in plain words. A goal Ruken cannot express is refused at ship
  with a sentence that says which.
- **web, itch and tauri** have no achievements today. The declaration is accepted and nothing is drawn or stored; a
  later host with achievements gets its own mapping in its target, with no change to a game.

The titles and descriptions are messages, translated like the rest. (Reference for how Ruken's rules look:
FloorFifty's `ruken/score-boards.ts`.)

### 7. Stale-build check (`@automata/net`, with `@automata/net-server`)

Before the title of an online game, the client asks the server for its build facts and compares them with its own
(`managers/boot-version-check.ts`, 47 lines). A mismatch shows a recoverable error that says the game was updated and
offers Reload. Anything unreadable passes, because the join check stays the authority. The server serves its build
facts from the build stamp the ship step already knows.

## Examples

In `examples/2d/`, one file each, with the header the catalog test checks and a journey in `examples/2d/tests`. The
site's Examples page reads these files when it builds (`site/README.md`). The one site change allowed is adding the
extensions an example imports (`@automata/ui-screens`) to the playground's import map, with its test.

| Example | Shows |
|---|---|
| `core/core-languages.ts` | The menus in six languages; change it in Settings and it stays |
| `core/core-first-run.ts` | A first run: pick a language, read the warning, then the title; a second run goes straight in |
| `audio/audio-ui-sounds.ts` | Buttons that sound by default, a Back that sounds different, one that stays silent |
| `ui/ui-splash-credits.ts` | A studio splash, then a title with a Credits panel |

Achievements and the stale-build check have nothing to see in a single page, so they get no example: achievements are
documented in `docs/guides/publish-to-ruken.md` and shown by Emberwick declaring one; the stale-build check is
documented in `extensions/net/README.md` and covered by a journey.

## The website

The framework's `site/` is the site: it reads the guides, the API index and `examples/` at build time. The separate
`mcthaydt/automata-website` repository is retired (the Owner, 2026-11-11) and is out of this work.
`mcthaydt/automata-skills` is kept. The new examples and guide lines reach the site through the framework's build.

## Left to the builder

- The exact `defineGame` field names, the copy keys, and how the first-run steps sit in `app/flow/`.
- The sound names beyond `back` and `none`, and the starter sounds.
- The credits file's schema.

## Done means

- The four examples run and their journeys pass in Chromium at phone, compact and iPad sizes.
- Emberwick's journeys pass in each of the six languages' menus, and its Ruken manifest carries an achievement.
- `automata words` translates everything or one line, into one language or all, against a fake model in tests; and
  `automata check` fails on a missing word, a lost placeholder, or a character a font cannot draw.
- `pnpm check` passes; API reports and the index are updated; changesets are written.
- Reported, not claimed: WebKit, Firefox and real devices are the Owner's.

## The coordinator's calls, for the Owner to check

1. Placement by owner (approach C), including the warning and interface sounds in core.
2. FloorFifty's six languages become the framework's default set.
3. Settled by the Owner: translations are written new and shipped, with no review state.
4. A host-supplied locale skips the first-run language screen.
5. No example for achievements or the stale-build check.
6. Settled by the Owner: refactor work is recorded in `docs/refactor/`, everything else in `docs/superpowers/`. This
   work adds features, so it is here.
