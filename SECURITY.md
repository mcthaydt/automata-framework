# Security policy

## Reporting a vulnerability

Please report it privately, never in a public issue or pull request:

1. **GitHub private vulnerability reporting** (preferred):
   [open a draft advisory](https://github.com/mcthaydt/automata-framework/security/advisories/new).
2. **Email:** hello@automataframework.com, with "AF security" in the subject.

Include the affected package and version (or commit), what an attacker can do, and steps to reproduce.

## What happens next

- We acknowledge your report within 3 working days.
- We send an assessment (accepted or not, with a severity) within 10 working days.
- A fix for an accepted report is released as a patch of every affected `@mcthaydt/automata-*` package, with
  a GitHub security advisory that credits you unless you ask us not to.

AF has one maintainer today, so these windows are what one person can keep.

## Scope

In scope: the packages in `packages/`, the tooling in `tooling/` and this repository's workflows.

Out of scope here: Ruken, the host that runs AF games (report those to Ruken), and games built on AF (report
those to the game's author).

## Supported versions

Before 1.0, only the latest published `0.0.x` release gets fixes.
