<script lang="ts">
import PageMeta from '../../shared/components/PageMeta.svelte'
import { CONTACT_EMAIL, SECURITY_EMAIL } from '../../shared/site.js'
</script>
<PageMeta title="Terms" description="The terms for this site and the Automata framework code: MIT-licensed framework code, separate terms for assets and dependencies, no warranty." />
<div class="page-shell legal-page">
  <h1>Terms</h1>
  <p class="lead">Plain terms for using this site and the code it shows.</p>
  <section><h2>Framework code</h2><p>The Automata framework code is MIT licensed. You may use, change and sell games built with it under that license's terms, keeping its copyright and license notice.</p></section>
  <section><h2>Assets and dependencies</h2><p>Fonts, example art and third-party packages keep their own licenses. The MIT license does not replace them. Check each asset's provenance file before you redistribute it.</p></section>
  <section><h2>Demos and examples</h2><p>The demos and code samples on this site are framework examples. They are provided to learn from and build on, under the same terms as the framework code.</p></section>
  <section><h2>Signing in with GitHub</h2><p>Signing in is optional. Your games kept on GitHub are yours, in your repositories, under GitHub's own terms; Automata reads and writes only the repositories you choose to let it see, and you can stop at any time from GitHub's settings. Keeping a copy of your work is your job too: Save a copy in the editors gives you a file.</p></section>
  <section><h2>No warranty</h2><p>The site, the demos and the framework are provided as is, without warranty of any kind. The authors are not liable for any claim or damage arising from their use, as the MIT license states.</p></section>
  <section><h2>Contact</h2><p>Questions: <a href={'mailto:' + CONTACT_EMAIL}>{CONTACT_EMAIL}</a>. Security reports: <a href={'mailto:' + SECURITY_EMAIL}>{SECURITY_EMAIL}</a>, as listed in <a href="/.well-known/security.txt">security.txt</a>. See also the <a href="/privacy">privacy page</a>.</p></section>
</div>
