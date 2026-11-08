<script lang="ts">
// "The editor": one picture of the level editor, loaded only when the reader nears it.
import NearView from '../../shared/components/NearView.svelte'
import { pictureOf } from '../../shared/pictures'

const editor = pictureOf('editor')
</script>

<section class="home-section">
  <div class="page-wrap">
    <p class="home-kicker">The editor</p>
    <h2>Draw levels. The game reads the same files.</h2>
    <p class="home-sub">
      The level editor runs in the browser. It writes the content files in your game, and the game picks them up when
      you save.
    </p>
    <div class="wide">
      <!-- Far below the poster: in the page only once the reader is near it (NearView). -->
      <NearView>
        <picture>
          <source media="(max-width: 760px)" type="image/webp" srcset="/previews/editor-phone.webp" />
          <source media="(max-width: 760px)" srcset="/previews/editor-phone.jpg" />
          <source
            type="image/webp"
            srcset="/previews/editor-640.webp 640w, /previews/editor.webp 1600w"
            sizes="(max-width: 1200px) 92vw, 1120px"
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
    <p class="home-more"><a href="/editor">More about the editor</a></p>
  </div>
</section>

<style>
  .wide {
    margin-top: 48px;
    overflow: hidden;
    border: 1px solid var(--line-strong);
    border-radius: var(--edge-lg);
    box-shadow: 0 24px 64px -32px rgb(17 21 28 / 0.3);
  }
  .wide,
  .wide img {
    aspect-ratio: 16 / 10;
  }
  .wide img {
    display: block;
    width: 100%;
    height: auto;
    object-fit: cover;
    object-position: 50% 0;
  }
  @media (max-width: 760px) {
    .wide {
      width: min(300px, 100%);
      margin-inline: auto;
    }
    .wide,
    .wide img {
      aspect-ratio: 390 / 844;
    }
  }
</style>
