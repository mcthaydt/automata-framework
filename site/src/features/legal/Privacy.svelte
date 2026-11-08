<script lang="ts">
import PageMeta from '../../shared/components/PageMeta.svelte'
import PageShell from '../../shared/components/PageShell.svelte'
import { CONTACT_EMAIL } from '../../shared/site.js'
// Each statement here is pinned by a check (quality-bar spec, "terms and privacy that match the code"):
// cookies, third-party requests and browser storage by tests/e2e/site.e2e.ts; forms by scripts/site-checks.ts.
</script>
<PageMeta title="Privacy" description="What this site collects: nothing. No cookies, no analytics, no forms and no requests to other sites." />
<PageShell class="legal-page">
  <h1>Privacy</h1>
  <p class="lead">This site collects nothing about you.</p>
  <section><h2>No cookies, no analytics</h2><p>The site sets no cookies and runs no analytics, tracking or advertising code. There is no cookie banner because there is nothing to consent to.</p></section>
  <section><h2>No requests to other sites</h2><p>Every page, font, image and demo is served from this site. Pages make no requests to other services. Links to GitHub and other sites are only followed when you choose them.</p></section>
  <section><h2>No accounts or forms</h2><p>There are no accounts and no forms. Search runs in your browser and sends nothing.</p></section>
  <section><h2>Your browser's storage</h2><p>The site itself stores nothing in your browser. If you start an embedded demo, the demo may keep its game state in this browser's local storage. The try-it editor at /editor/app/ keeps the levels you make in this browser's storage and sends them nowhere. That data stays on your device; clear it by clearing this site's data in your browser. The examples' live preview can't use your browser's storage, and an edit you make to an example lives only in the page's address.</p></section>
  <section><h2>Hosting</h2><p>The site is static files. Like any web server, the host that serves them receives the standard request details: your IP address, the page requested and your browser's user agent. Automata adds no tracking on top of that.</p></section>
  <section><h2>Questions</h2><p>Email <a href={'mailto:' + CONTACT_EMAIL}>{CONTACT_EMAIL}</a>. See also the <a href="/terms">terms</a>.</p></section>
</PageShell>
