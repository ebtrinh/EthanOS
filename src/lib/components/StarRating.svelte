<script>
	let { rating = 0, max = 5, interactive = false, onrate } = $props();

	function handleClick(value) {
		if (interactive && onrate) {
			onrate(value);
		}
	}
</script>

<div class="star-rating" class:interactive>
	{#each Array(max) as _, i}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<span
			class="star"
			class:filled={i < rating}
			onclick={() => handleClick(i + 1)}
		>&#9733;</span>
	{/each}
</div>
