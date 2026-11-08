<!--
  /app: what the paid Automata app is, what it costs and where to buy it. Everything it says comes from app-offer.ts;
  a place to buy with no link yet reads "Coming soon" as words, never as a button that goes nowhere.
-->
<script lang="ts">
import PageMeta from '../../shared/components/PageMeta.svelte'
import PageShell from '../../shared/components/PageShell.svelte'
import { NO_CREDITS } from '../../shared/content/pricing'
import { CONTACT_EMAIL } from '../../shared/site.js'
import { APP_OFFER, type AppOffer, type Purchase } from './app-offer'

let { offer = APP_OFFER }: { offer?: AppOffer } = $props()
const purchases: readonly { readonly name: string; readonly purchase: Purchase }[] = $derived([
  { name: 'Phone and tablet', purchase: offer.phone },
  { name: 'Computer', purchase: offer.computer },
])
</script>

<PageMeta
  title="Pricing"
  description={`Every editor is free on the web, and so is syncing your games with GitHub. The app is paid once: ${offer.phone.price} for phone and tablet, ${offer.computer.price} for computer. No credits, ever.`}
/>
<PageShell>
  <header>
    <p class="kicker">Pricing</p>
    <h1>Free to make games. Pay once for the app.</h1>
    <p class="lead">
      Every editor is free on the web. You pay only to download the app, made for your phone, tablet or computer. You
      pay once, and it is yours. {NO_CREDITS}
    </p>
  </header>

  <div class="prices">
    {#each purchases as { name, purchase } (name)}
      <section class="price" aria-labelledby={'price-' + purchase.price}>
        <h2 id={'price-' + purchase.price}>{name}</h2>
        <p class="amount">{purchase.price}, paid once</p>
        <p>{purchase.devices}</p>
        <ul class="buy">
          {#each purchase.buy as place (place.label)}
            <li>
              {#if place.url}
                <a class="button" href={place.url}>{place.label}</a>
              {:else}
                {place.label}: <span class="soon">Coming soon</span>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
  <p>
    These are two separate purchases. Buying the phone app does not unlock the computer app, or the other way round.
  </p>

  <div class="lists">
    <section>
      <h2>Free in your browser</h2>
      <ul>{#each offer.web as item (item)}<li>{item}</li>{/each}</ul>
    </section>
    <section>
      <h2>When you download</h2>
      <ul>{#each offer.app as item (item)}<li>{item}</li>{/each}</ul>
    </section>
  </div>

  <section id="credits">
    <h2>Why there are no credits</h2>
    <p>
      Many AI game makers sell credits: you pay each time their AI works, and the meter runs out mid-project. Automata runs
      no AI of its own. Your coding agent (Claude Code, Cursor, Codex or another) does the work on the plan you already
      have, so there is nothing for us to meter.
    </p>
    <p>
      Automata's code is MIT licensed. What you pay for is the ready-made app, which installs in one step and keeps itself
      up to date.
    </p>
  </section>

  <section id="help">
    <h2>Help</h2>
    <p>Questions about the app? Write to <a href={'mailto:' + CONTACT_EMAIL}>{CONTACT_EMAIL}</a>.</p>
  </section>
</PageShell>

<style>
  .prices,
  .lists {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
    margin-block: 32px;
  }
  .price {
    border: 1px solid var(--line);
    border-radius: var(--edge-md);
    background: var(--panel);
    padding: 24px;
  }
  .price h2 {
    margin-top: 0;
  }
  .amount {
    font-size: var(--step-lead);
    font-weight: 600;
    margin-block: 8px;
  }
  .buy {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  .soon {
    color: var(--muted);
  }
  #help {
    margin-top: 48px;
  }
</style>
