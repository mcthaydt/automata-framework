<script lang="ts">
let email = $state('')
</script>

<form>
  <h2>Sign in to continue</h2>
  <input type="email" bind:value={email} />
  <input type="password" />
</form>
