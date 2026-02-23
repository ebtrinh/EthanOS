<script>
	import { onMount } from 'svelte';

	let { sidebarOpen = $bindable(false) } = $props();

	let clockText = $state('');

	onMount(() => {
		function tick() {
			const now = new Date();
			clockText = now.toLocaleDateString('en-US', {
				weekday: 'short',
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				second: '2-digit',
				hour12: true
			});
		}

		tick();
		const interval = setInterval(tick, 1000);

		return () => clearInterval(interval);
	});

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}
</script>

<header class="topbar">
	<div class="topbar-left">
		<button class="hamburger" onclick={toggleSidebar} aria-label="Toggle navigation">&#9776;</button>
		<a href="/" class="logo" style="text-decoration:none">EthanOS</a>
	</div>
	<div class="topbar-center">
		<span class="clock">{clockText}</span>
	</div>
	<div class="topbar-right"></div>
</header>
