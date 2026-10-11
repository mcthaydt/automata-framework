# Cross-engine parity in a cloud container

`ci.yml` skips the parity job on draft pull requests, so af-linux (one shared PC runner) only takes it when a PR is
ready for review and on every push to `main`. While a PR is a draft, run the same gate in a cloud container
(Ubuntu 24.04, root). The steps below were proven in an M2.2 session on 2026-10-11.

1. Install Node 24.21 from nodejs.org (the version in `.nvmrc`) and `corepack enable`.
2. Install the browsers into a fresh folder. The preinstalled `/opt/pw-browsers` is older than the pinned Playwright
   and does not work:

   ```sh
   PLAYWRIGHT_BROWSERS_PATH=/tmp/pw pnpm exec playwright install chromium-headless-shell webkit firefox
   ```

3. Install WebKit's and Firefox's system libraries:

   ```sh
   apt-get update   # a fresh container's package index is stale; without this, four packages are not found
   apt-get install -y libgtk-4-1 libgraphene-1.0-0 libevent-2.1-7 libgstreamer-gl1.0-0 \
     libgstreamer-plugins-bad1.0-0 libavif16 libwayland-server0 libmanette-0.2-0 libenchant-2-2 \
     libsecret-1-0 libgles2
   ```

4. Run every CI job locally, parity included:

   ```sh
   PLAYWRIGHT_BROWSERS_PATH=/tmp/pw pnpm ci:local
   ```

Record the result on the PR. Marking the PR ready for review then runs parity on af-linux as the merge gate.
