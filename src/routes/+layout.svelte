<script>
	import '../app.css';
	import Nav from '$lib/components/Nav.svelte';
	import Topbar from '$lib/components/Topbar.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { onMount } from 'svelte';
	import { initData } from '$lib/stores/data.js';

	let { children } = $props();

	let sidebarOpen = $state(false);

	onMount(() => {
		initData();
	});
</script>

<Topbar bind:sidebarOpen />
<Nav bind:open={sidebarOpen} />
<main class="main-content">
	{@render children()}
</main>
<Toast />
<Modal />
