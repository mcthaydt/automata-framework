<!--
  /app: what the paid Automata app is, what it costs and where to buy it. Everything it says comes from app-offer.ts;
  a place to buy with no link yet reads "Coming soon" as words, never as a button that goes nowhere.
-->
<script lang="ts">
import PageMeta from '../../shared/components/PageMeta.svelte'
import PageShell from '../../shared/components/PageShell.svelte'
import { CONTACT_EMAIL } from '../../shared/site.js'
import { APP_OFFER, type AppOffer, type Purchase } from './app-offer'

let { offer = APP_OFFER }: { offer?: AppOffer } = $props()
const purchases: readonly { readonly name: string; readonly purchase: Purchase }[] = $derived([
  { name: 'Phone and tablet', purchase: offer.phone },
  { name: 'Computer', purchase: offer.computer },
])
</script>

<PageMeta
  title="Get the Automata app"
  description="The Automata editors, made for your phone, tablet or computer. $19.99 once for phone and tablet, $39.99 once for computer."
/>
<PageShell>
  <header>
    <p class="kicker">The app</p>
    <h1>Get the Automata app</h1>
    <p class="lead">
      Make your game on the web for free. The app adds more editors and works on your phone, tablet or computer.
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
      <h2>In the app</h2>
      <ul>{#each offer.app as item (item)}<li>{item}</li>{/each}</ul>
    </section>
  </div>

  <p>
    All of Automata's code is open source (MIT). You pay for the ready-made app: it installs in one step, keeps itself up to
    date and runs on your phone.
  </p>

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
