<script>
	import { categories } from '$lib/stores/data.js';
	import { BADGE_CLASS_MAP } from '$lib/helpers.js';

	let { categoryId } = $props();

	let cat = $derived($categories.find((c) => c.id === categoryId));
	let badgeClass = $derived(cat ? BADGE_CLASS_MAP[cat.color] || '' : '');
</script>

{#if cat}
	<span class="badge {badgeClass}">{cat.icon} {cat.name}</span>
{:else}
	<span class="badge badge-muted">Unknown</span>
{/if}
