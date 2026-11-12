---
'@automata/framework': patch
'@automata/ui-screens': patch
'@automata/net-ui': patch
---

`@automata/framework` exports the locale pieces a game with its own words needs: `bindWords` (keeps `data-word` and `data-word-label` elements of a plain-DOM panel in the player's language, and fills them again when it changes), `matchLocale` (the rule the runtime chooses a language by), `formatNumber` and `DEFAULT_LOCALES`. `@automata/ui-screens` and `@automata/net-ui` use `matchLocale` instead of their own copy of the rule.
