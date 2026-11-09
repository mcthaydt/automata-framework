<script lang="ts">
// "The editor": one picture of the level editor, loaded only when the reader nears it. The editor's own look is
// the editors' (a separate redesign), so the picture is shown as it is, in its panel. The phone picture waits until the
// try-it editor fits a phone (the audit's I2), so a phone sees this one too.
import Icon from '../../shared/components/Icon.svelte'
import InlineText from '../../shared/components/InlineText.svelte'
import NearView from '../../shared/components/NearView.svelte'
import { pictureOf } from '../../shared/pictures'
import { EDITOR_SECTION } from './home-content'

const editor = pictureOf('editor')
</script>

<section class="home-section">
  <div class="page-wrap home-chess">
    <div class="text">
      <span class="home-kicker"><Icon name="brush" size={14} />{EDITOR_SECTION.kicker}</span>
      <h2>{EDITOR_SECTION.title}</h2>
      <p class="home-sub">{EDITOR_SECTION.sub}</p>
      <ul class="home-points">
        {#each EDITOR_SECTION.points as [lead, rest] (lead)}
          <li><Icon name="check" /><span><strong>{lead}</strong> <InlineText text={rest} /></span></li>
        {/each}
      </ul>
      <p class="more"><a class="home-secondary" href="/editor">Try the level editor <Icon name="arrowRight" /></a></p>
    </div>
    <div class="show home-panel shot">
      <!-- Far below the poster: in the page only once the reader is near it (NearView). -->
      <NearView>
        <picture>
          <source
            type="image/webp"
            srcset="/previews/editor-640.webp 640w, /previews/editor.webp 1600w"
            sizes="(max-width: 1023px) 92vw, 680px"
          />
          <img
            src="/previews/editor.jpg"
            width={editor.width}
            height={editor.height}
            loading="lazy"
            alt="The level editor on a new platformer: the layers on the left, the room in the middle, its details on the right"
          />
        </picture>
      </NearView>
    </div>
  </div>
</section>

<style>
  .more {
    margin: 32px 0 0;
  }
  .shot,
  .shot img {
    aspect-ratio: 16 / 10;
  }
  .shot img {
    display: block;
    width: 100%;
    height: auto;
    object-fit: cover;
    object-position: 50% 0;
  }
</style>
