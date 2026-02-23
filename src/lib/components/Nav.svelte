<script>
	import { page } from '$app/stores';

	let { open = $bindable(false) } = $props();

	const NAV_ITEMS = [
		{ section: 'Core' },
		{ label: 'Command Center', icon: '\u{1F4CA}', href: '/' },
		{ label: 'Academic Brain', icon: '\u{1F4DA}', href: '/academic' },
		{ label: 'Schedule', icon: '\u{1F4C5}', href: '/schedule' },
		{ label: 'Goals', icon: '\u{1F3AF}', href: '/goals' },
		{ label: 'Analytics', icon: '\u{1F4C8}', href: '/analytics' },
		{ section: 'Focus & Health' },
		{ label: 'Focus Mode', icon: '\u{1F525}', href: '/focus' },
		{ label: 'Energy & Mood', icon: '\u{1F49A}', href: '/energy' },
		{ label: 'Burnout Monitor', icon: '\u{1F6E1}\u{FE0F}', href: '/burnout' },
		{ label: 'Procrastination', icon: '\u{23F3}', href: '/procrastination' },
		{ section: 'Planning' },
		{ label: 'Roadmap', icon: '\u{1F5FA}\u{FE0F}', href: '/roadmap' },
		{ label: 'Decisions', icon: '\u{2696}\u{FE0F}', href: '/decisions' },
		{ label: 'Life Balance', icon: '\u{26A1}', href: '/balance' },
		{ label: 'Big Picture', icon: '\u{1F441}\u{FE0F}', href: '/bigpicture' },
		{ section: 'Growth' },
		{ label: 'Identity', icon: '\u{1F9EC}', href: '/identity' },
		{ label: 'Knowledge Vault', icon: '\u{1F4DD}', href: '/vault' },
		{ label: 'XP & Score', icon: '\u{1F3C6}', href: '/xp' },
		{ section: 'System' },
		{ label: 'Settings', icon: '\u{2699}\u{FE0F}', href: '/settings' }
	];

	function closeSidebar() {
		open = false;
	}

	function isActive(href) {
		const path = $page.url.pathname;
		if (href === '/') return path === '/';
		return path.startsWith(href);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="sidebar-overlay" class:visible={open} onclick={closeSidebar} style:display={open ? 'block' : ''}></div>

<nav class="sidebar" class:open>
	{#each NAV_ITEMS as item}
		{#if item.section}
			<div class="nav-section-label">{item.section}</div>
		{:else}
			<a class="nav-item" class:active={isActive(item.href)} href={item.href} onclick={closeSidebar}>
				<span class="nav-icon">{item.icon}</span>
				<span class="nav-label">{item.label}</span>
			</a>
		{/if}
	{/each}
	<div class="sidebar-footer">
		<div class="sidebar-version">EthanOS v1.0</div>
	</div>
</nav>
