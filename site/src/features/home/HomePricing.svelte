<script lang="ts">
// "Pricing": free in the browser, the app paid once, and no credits. The research found money is the top complaint in
// game-tool reviews and credit meters the most hated thing in AI game makers, so the price is said on Home, not only on
// /app. Both read the prices from `shared/content/pricing.ts`. The link is the secondary: Home keeps one lime button.
import Icon from '../../shared/components/Icon.svelte'
import { APP_PRICES, NO_CREDITS } from '../../shared/content/pricing'
import { PRICING_SECTION } from './home-content'
</script>

<section class="home-section">
  <div class="page-wrap">
    <span class="home-kicker"><Icon name="store" size={14} />{PRICING_SECTION.kicker}</span>
    <h2>{PRICING_SECTION.title}</h2>
    <p class="home-sub">{PRICING_SECTION.sub} <strong>{NO_CREDITS}</strong></p>
    <div class="plans">
      <div class="plan home-panel">
        <h3>{PRICING_SECTION.free.title}</h3>
        <p class="amount">$0</p>
        <ul class="home-points">
          {#each PRICING_SECTION.free.items as item (item)}<li><Icon name="check" /><span>{item}</span></li>{/each}
        </ul>
      </div>
      <div class="plan home-panel">
        <h3>{PRICING_SECTION.app.title}</h3>
        <p class="amount">{APP_PRICES.phone} <span>phone and tablet</span></p>
        <p class="amount">{APP_PRICES.computer} <span>computer</span></p>
        <ul class="home-points">
          {#each PRICING_SECTION.app.items as item (item)}<li><Icon name="check" /><span>{item}</span></li>{/each}
        </ul>
        <p class="more"><a class="home-secondary" href="/app">{PRICING_SECTION.more} <Icon name="arrowRight" /></a></p>
      </div>
    </div>
  </div>
</section>

<style>
  .plans {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 56px;
  }
  .plan {
    padding: 24px;
  }
  h3 {
    margin: 0;
    font-size: 16px;
    line-height: 22px;
    letter-spacing: 0;
  }
  .amount {
    margin: 12px 0 0;
    font-size: 28px;
    font-weight: 600;
    line-height: 34px;
  }
  .amount span {
    color: var(--muted);
    font-size: 14px;
    font-weight: 400;
  }
  .more {
    margin: 20px 0 0;
  }
  @media (max-width: 760px) {
    .plans {
      grid-template-columns: 1fr;
      margin-top: 40px;
    }
  }
</style>
