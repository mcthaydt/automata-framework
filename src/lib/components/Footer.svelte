<script lang="ts">
  import { CONTACT_EMAIL } from '$lib/site.js'
</script>
<footer class="site-footer">
  <div class="footer-top">
    <p>AI-first game development.<br />Code with agents. Keep creative control.</p>
    <nav aria-label="Footer navigation">
      <a href="/start">First AI change</a><a href="/examples">Examples</a><a href="/cheatsheet">API reference</a><a href="/ai">AI & Skills</a><a href="/docs/faq">FAQ</a><a href="/showcase">Community showcase</a><a href="/inside">What’s inside</a><a href="/proof">Proof</a><a href="/docs/capabilities">Capabilities & MIT license</a>
      <a href="https://github.com/mcthaydt/automata-framework">Framework source</a>
    </nav>
  </div>
  <a href="/" class="footer-wordmark" aria-label="Automata home">automata<span class="brand-dot" aria-hidden="true"></span></a>
  <div class="footer-bottom">
    <p class="small">MIT framework code · © {new Date().getFullYear()} Automata</p>
    <nav aria-label="Legal and contact"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/.well-known/security.txt">Security</a><a href={'mailto:' + CONTACT_EMAIL}>{CONTACT_EMAIL}</a></nav>
  </div>
</footer>
