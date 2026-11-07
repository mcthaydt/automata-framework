<!--
  @component
  A Modal on the bottom edge at every form factor (M4 spec §4.12): the same scoping, Close and
  scroll region, where a thumb reaches the actions. Settings' sub-pages and a "more" menu use it.
-->
<script lang="ts">
import Modal from './Modal.svelte'
import type { ModalProps } from './modal-props.js'

const props: ModalProps = $props()
</script>

<Modal {...props} anchor="bottom" />
