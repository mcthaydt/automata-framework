# Runbook

Three procedures: what to do when credentials are lost or stolen, how to rebuild everything from Git, and how the
website goes live. The Owner runs both; an agent never holds these credentials (AGENTS.md).

## Lost credentials

Use this when a laptop, phone or token with access to AF is lost, stolen or pasted somewhere it should not be,
including into an AI chat.

**What counts as production access today.** AF publishes packages only from CI, with the workflow's own
`GITHUB_TOKEN` (`release-packages.yml`), which expires with each run, behind the Owner-approved `release`
environment. Nothing publishes from a laptop. The long-lived credentials are:

| Credential | Where it lives | What it can do |
|---|---|---|
| The Owner's GitHub account (password, sessions, SSH keys, personal access tokens) | GitHub | Everything: push, approve the `release` environment, change settings |
| `AF_READ_TOKEN` (classic token, `read:packages`) | Secrets of each game repository | Install `@mcthaydt` packages from GitHub Packages |
| `RUKEN_TOKEN` | Secrets of each game repository | `ruken publish` for that game |
| `SHIP_DEV_SSH_KEY`, `SHIP_DEV_KNOWN_HOSTS` | Secrets of each game repository | Deploy a game to the dev host |
| The `af-linux` runner registration | The runner PC (`owner-pc-wsl-af`, the Owner's Windows PC under WSL2 Ubuntu-24.04; service `actions.runner.mcthaydt-automata-framework.owner-pc-wsl-af`) | Run the checks, the games' CI and the consumer smoke for this repository (since 2026-10-30, when `AF_LINUX_RUNNER` went back from `af-mac` to `af-linux`) |
| The `af-mac` runner registrations | The Owner's Mac | Run CI jobs and, since 2026-10-30, the release jobs (`release-packages.yml`: version, and publish behind the `release` approval) |
| The npm token for npmjs.org | Not created yet | Will publish the public packages |
| `SITE_DEPLOY_TOKEN` | This repository's secrets (not created yet) | Upload the website to its host from `main` (`site.yml`); without it the deploy says "No host configured yet." |
| `SKILLS_TOKEN` | This repository's secrets (not created yet) | Push the agent package to `mcthaydt/automata-skills` after each release; without it the release says "No skills token yet." and the mirror waits |

**Do this, in order, from a device you still trust:**

1. **GitHub account.** Change the password. In Settings → Sessions, sign out every other session. In SSH and
   GPG keys and in Developer settings → Personal access tokens, delete every key and token the lost device
   held. Check that two-factor authentication is still yours, and regenerate the recovery codes.
2. **Tokens in game repositories.** Revoke the old `AF_READ_TOKEN`, create a new classic token with
   `read:packages` only, and update the secret in each game repository. Rotate `RUKEN_TOKEN` in Ruken and the
   dev host's SSH key the same way.
3. **Runner.** If the runner PC was lost, remove `af-linux` in Settings → Actions → Runners. Jobs then wait in
   the queue instead of running anywhere else (`ci.yml`).
4. **Check what happened.** Read the security log (Settings → Security log), the Actions runs and the packages'
   version lists for anything you did not do. Deprecate a package version you did not publish, and say so in a
   security advisory.
5. **If a secret reached Git.** Rotating it is the fix; a history rewrite is not. `pnpm secrets` then still
   reports the old commit. Add that one commit to `.gitleaks.toml`'s allowlist with the date it was rotated.
6. **Publish again from CI** if a release was in doubt: merge the next "Version packages" pull request and
   approve the `release` environment.

## Rebuild from Git

Everything that builds, tests and publishes AF is in this repository:

- the code, tests, goldens and replays;
- the lockfile and the pinned versions (`docs/versions.md`);
- Ruken's packages as vendored tarballs (`vendor/ruken/`);
- the workflows, the plans, the specs and the decisions (`docs/`).

Published versions live in GitHub Packages, and from the first public release also on npmjs.org.

**Not in Git, and where each is kept:**

| What | Where it is held | How to restore it |
|---|---|---|
| Repository settings: the `release` environment and its reviewer, rulesets, private vulnerability reporting | GitHub repository settings | Recreate them by hand from this list (the Owner's setup steps are in [the archived delivery plan](archive/02-master-delivery-plan.md)) |
| Repository variables `AF_LINUX_RUNNER`, `AF_GPU_RUNNER` | GitHub repository settings | Unset means `af-linux`; set them only to move jobs (2026-10-30: `AF_LINUX_RUNNER` = `af-linux`; it was `af-mac` from about 2026-10-17) |
| Game repository secrets and variables (`AF_READ_TOKEN`, `RUKEN_TOKEN`, `RUKEN_API`, `RUKEN_GAME`, `SHIP_DEV_*`) | Each game repository | Create new tokens, as in "Lost credentials" |
| The `af-linux` self-hosted runner | The Owner's PC (WSL2 Ubuntu with Docker) | Register a new runner with the label `af-linux` (Ruken's `docs/self-hosted-runner.md`) |
| The Renovate app installation | GitHub Apps | Install it on the repository again; `renovate.json` holds the configuration |
| The domain `automataframework.com` and its DNS | The registrar | The website's address (`SITE_ORIGIN` in `site/src/lib/site.js`); point it at the site's host again |

**Rebuild, step by step:**

1. Clone the repository on a machine with Git and Node 24.21.0, then `corepack enable` and `pnpm install`.
   If GitHub itself is gone, use any clone: every clone carries the full history.
2. Run `pnpm ci:local`. It checks, builds and tests everything CI does, including parity in three browsers.
   It needs the full history, not a shallow clone, for `pnpm secrets` and `changeset status`.
3. Push to a new GitHub repository, then restore the settings in the table above.
4. If GitHub Packages lost the published versions, run the release workflow from `main` again. Changesets
   publishes every version the registry is missing, and `verify-published.ts` checks the result.
5. Record what was rebuilt, and when, in [03 Continuation](archive/03-continuation-prompt.md).

## Launch the website

The website (`site/`) builds and is tested on every pull request inside `ci.yml`'s 2D journeys. From `main`, the
`site` job (`.github/workflows/site.yml`) deploys it once these are done. The Owner does steps 1 to 3; the agent does
step 4 in one pull request.

1. **Choose the host** (any static host that serves a folder over HTTPS and lets you set response headers), create its
   deploy token, and add it as the repository secret `SITE_DEPLOY_TOKEN`. Until then every deploy says "No host
   configured yet." and passes. With the token but before step 4, the deploy fails on purpose: its upload step is not
   written yet.
2. **Point the domain at it.** `automataframework.com`: an apex record (or the host's `ALIAS`, `ANAME` or flattened
   `CNAME`), `www` redirecting to the apex, and HTTPS on at the host.
3. **Name the project's addresses**, one for questions and one for security reports, on the project's own domain.
   `pnpm --filter @mcthaydt/automata-site check:launch` refuses a personal mailbox, so the deploy waits for them.
4. **The agent's pull request:** the addresses in `site/src/shared/site.js` and `site/static/.well-known/security.txt`
   (a unit test keeps the two the same), the host's upload step in `site.yml` with the headers of
   `site/src/shared/html/security-headers.ts`, and these steps marked done. Merging it deploys.
5. **Look at it** on a phone and on the iPad: the home page, play Emberwick, Start, Try the editor.

