<script>
	import { modalState, closeModal } from '$lib/stores/modal.js';

	function handleOverlayClick(e) {
		if (e.target === e.currentTarget) {
			closeModal();
		}
	}

	function handleKeydown(e) {
		if (e.key === 'Escape') {
			closeModal();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if $modalState.open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="modal-overlay visible" onclick={handleOverlayClick}>
		<div class="modal">
			<div class="modal-header">
				<h2 class="modal-title">{$modalState.title}</h2>
				<button class="modal-close" onclick={closeModal} aria-label="Close">&times;</button>
			</div>
			<div class="modal-body">
				{#if $modalState.component}
					<svelte:component this={$modalState.component} {...$modalState.props || {}} />
				{:else if $modalState.content}
					{@html $modalState.content}
				{/if}
			</div>
		</div>
	</div>
{/if}
