<script lang="ts">
// "Made with Automata": the studios that ship on it, as a logo carousel that scrolls by itself. One studio so far, so
// its logo is repeated to fill the track. The track is two identical halves, so moving it by half loops without a seam;
// it pauses under a pointer and stands still when the visitor asks for less motion. Only the first logo is read out.
import { MADE_WITH } from './home-content'

const REPEAT = 6
const logos = Array.from({ length: REPEAT }, (_, index) => ({
  index,
  ...MADE_WITH[index % MADE_WITH.length]!,
}))
</script>

<div class="made" role="group" aria-label="Made with Automata">
  <div class="track">
    {#each [0, 1] as half (half)}
      <div class="set" aria-hidden={half === 1 ? 'true' : undefined}>
        {#each logos as logo (logo.index)}
          <picture aria-hidden={half === 1 || logo.index > 0 ? 'true' : undefined}>
            <img
              src={logo.sources[1].src}
              srcset={logo.sources.map((source) => `${source.src} ${source.width}w`).join(', ')}
              sizes="(max-width: 760px) 112px, 160px"
              width={logo.width}
              height={logo.height}
              loading="lazy"
              alt={half === 0 && logo.index === 0 ? logo.name : ''}
            />
          </picture>
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
  .made {
    overflow: hidden;
    border-bottom: 1px solid var(--line);
    mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
  }
  .track {
    display: flex;
    width: max-content;
    animation: marquee 40s linear infinite;
  }
  .made:hover .track {
    animation-play-state: paused;
  }
  .set {
    display: flex;
    align-items: center;
    gap: 96px;
    padding: 36px 48px;
  }
  img {
    display: block;
    width: auto;
    height: 40px;
    opacity: 0.9;
  }
  @keyframes marquee {
    to {
      transform: translateX(-50%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .track {
      animation: none;
    }
  }
  @media (max-width: 760px) {
    .set {
      gap: 56px;
      padding: 24px 28px;
    }
    img {
      height: 28px;
    }
  }
</style>
