<script>
	import { toasts, dismissToast } from '$lib/stores/toast.js';
	import { onMount } from 'svelte';

	const ICONS = {
		success: '\u{2705}',
		warning: '\u{26A0}\u{FE0F}',
		error: '\u{274C}',
		info: '\u{2139}\u{FE0F}'
	};

	let mounted = $state(false);

	onMount(() => {
		mounted = true;
	});
</script>

<div class="toast-container">
	{#each $toasts as toast (toast.id)}
		<div class="toast {toast.type}" class:visible={mounted}>
			<span class="toast-icon">{ICONS[toast.type] || ICONS.info}</span>
			<span class="toast-message">{toast.message}</span>
			<button class="toast-close" onclick={() => dismissToast(toast.id)} aria-label="Dismiss">&times;</button>
		</div>
	{/each}
</div>
