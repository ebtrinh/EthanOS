<script>
	let { percent = 0, color = '' } = $props();

	let clampedPercent = $derived(Math.max(0, Math.min(100, percent)));

	let colorClass = $derived(
		color === 'success' || color === 'green'
			? 'success'
			: color === 'warning' || color === 'orange'
				? 'warning'
				: color === 'danger' || color === 'red'
					? 'danger'
					: ''
	);
</script>

<div class="progress-bar">
	<div class="progress-bar-fill {colorClass}" style="width: {clampedPercent}%"></div>
</div>
