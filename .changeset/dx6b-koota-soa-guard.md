---
"@mcthaydt/automata-check-boundaries": patch
---

A new rule, `koota-soa`, fails a sim that gives koota's `trait` an object schema, or a `relation` an object `store`: koota compiles struct-of-arrays accessors for those with `new Function`, which Ruken's CSP (no `'unsafe-eval'`) refuses. A factory (`trait(() => ({ x: 0 }))`), a tag (`trait()`, `trait({})`) and a relation with no store or a factory store pass; so does `defineComponent`, which makes factories. A schema the checker cannot see (a variable, a call, a spread) is reported too, with the same fix. In `--inline` mode the rule checks every call in the file, not only the sim's arguments.
