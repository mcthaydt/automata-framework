# CI on rented Ubicloud runners: the Owner's brief

Given by the Owner on 2026-11-11, "for when we get there". It is not started. It runs as its own cycle (workstream 5 in
[`../progress.md`](../progress.md)): spec, plan, plan audit, execution, implementation audit, fixes. The brief below is
the Owner's, word for word; the notes after it are the coordinator's.

---

From the Owner, 2026-11-11: match Ruken's new CI setup.

THE RULE
- The Windows PC runs only what needs Windows or the GPU.
- The Mac runs only what needs macOS (Mac and iPhone builds, anything Apple-only).
- Every other job runs on rented Ubicloud runners, 8 cores: runs-on: ubicloud-standard-8.
- No job runs on GitHub's own machines (ubuntu-*, windows-*, macos-* labels). That ban stays.
- The Linux runners on the PC (WSL) and everything that exists only for them (setup scripts, runner-label variables, load caps, "is the tool installed" steps) get removed.
- Jobs that hold credentials (deploys, releases, backups) move to Ubicloud too. The Owner decided this on purpose.

WHY
Ruken's merge queue was stuck behind one PC: runners died and stayed dead, WSL restarted under running jobs, and one train took five attempts in twelve hours with no failure in its code. Measured on a 4-core cloud machine, the unit-test jobs took 9 and 17 minutes against 38 and 73 on the loaded PC.

FACTS ALREADY CHECKED (from Ubicloud's own docs and Ruken's plan audit)
- Setup is: sign up, add a card, install the Ubicloud GitHub app on the repository, change runs-on. The Owner does the account steps; no step may need a terminal.
- Use the label alone. Ubicloud's runners carry only their own label, so a list like [self-hosted, ubicloud-standard-8] would most likely wait forever.
- Each job gets a fresh Ubuntu 24.04 machine with sudo, thrown away afterwards. Install what the job needs in the job; do not assume anything is pre-installed or kept between runs.
- Do not branch on runner.environment: what an Ubicloud runner reports there is undocumented. Key any step condition on your own explicit setting.
- Premium runners are ON by default for a new account ($0.008/min for 8 cores). Standard is $0.005/min. Ruken runs with premium OFF.
- Billing has a spending cutoff and usage alerts. They are per month and per ACCOUNT, not per repository.
- Not published, so measure on the first run: how many runners an account may use at once, and whether Docker Hub rate-limits pulls from their machines.
- Capacity trouble at Ubicloud shows up as jobs waiting, not failing. The 16 and 30 core sizes queue first; stay on 8.

HOW TO DO IT
- Run it through the staged workflow as its own cycle: spec, plan, plan audit, execution, implementation audit, fixes. Tests first.
- Keep a test that fails if any job can reach a GitHub-hosted label, and that pins which jobs run on the PC and the Mac.
- No test step may be skipped or changed because of where it runs.
- Prove it with one full run on Ubicloud before relying on it: same passes and test counts as before, the minutes per job, the rate actually billed, and how many runners ran at once.
- Only remove the PC's Linux runners after that run is green.

ASK THE OWNER BEFORE SWITCHING ON
- Whether Automata uses the same Ubicloud account as Ruken. If it does, its minutes count against Ruken's $90 monthly cutoff.
- What spending limit Automata gets.

REPORTING
Tell your coordinator when the spec is written and what the first Ubicloud run measured. Raise anything only the Owner can answer, with options, before picking a default.

---

## The coordinator's notes for the spec, when it is written

Measured on `main` on 2026-11-11, to be re-measured then:

- The eight workflows (`3d`, `ci`, `consumer-smoke`, `game-ci`, `release-checks`, `release-packages`, `site`,
  `windows-trial`) choose their runner through repository variables with a self-hosted default: `af-mac` for checks,
  parity and releases, `af-linux` for the end-to-end, GPU and Linux jobs, `af-windows` for two. Those variables and
  defaults are the "runner-label variables" the brief removes.
- The 3D workflow fetches the private submodules with the Owner's read-only `SUBMODULES_TOKEN`. An Ubicloud job needs
  that secret too, or every 3D check fails on an empty `vendor/FigureBuilder`. It goes away if workstream 4 folds
  FigureBuilder into the framework.
- The 3D browser suites need WebGL. A fresh Ubuntu machine has no GPU, so they either run on software WebGL there (as
  the cloud sessions do) or stay on the PC as "needs the GPU". The frame-budget suite needs a real GPU by its own rule.
- Cross-engine parity (Chromium, WebKit, Firefox) installs browsers in the job; WebKit and Firefox have never run in a
  cloud session, so their first Ubicloud run is the first evidence either way.
- Until this is live, each stage session and the merge session run the gates themselves, and report what did not run.
