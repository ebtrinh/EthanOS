<script>
	import { categories, settings, saveStore, syncAll, exportAll, importAll } from '$lib/stores/data.js';
	import { generateId, COLOR_MAP } from '$lib/helpers.js';
	import { showToast } from '$lib/stores/toast.js';

	const COLOR_OPTIONS = [
		{ value: 'blue',   label: 'Blue' },
		{ value: 'purple', label: 'Purple' },
		{ value: 'green',  label: 'Green' },
		{ value: 'orange', label: 'Orange' },
		{ value: 'pink',   label: 'Pink' }
	];

	// --- Profile ---
	function updateUserName(e) {
		$settings.userName = e.target.value.trim() || 'Ethan';
		$settings = $settings;
		saveStore('settings', $settings);
		showToast('Name updated', 'success');
	}

	// --- Focus Timer ---
	let focusDisplay = $derived(($settings.focusDuration || 25) + ' min');
	let breakDisplay = $derived(($settings.breakDuration || 5) + ' min');

	function updateFocusDuration(e) {
		$settings.focusDuration = parseInt(e.target.value, 10);
		$settings = $settings;
		saveStore('settings', $settings);
		showToast('Focus duration updated', 'success');
	}

	function updateBreakDuration(e) {
		$settings.breakDuration = parseInt(e.target.value, 10);
		$settings = $settings;
		saveStore('settings', $settings);
		showToast('Break duration updated', 'success');
	}

	// --- Category CRUD ---
	let showCatModal = $state(false);
	let editingCatId = $state(null);
	let catIcon = $state('');
	let catName = $state('');
	let catColor = $state('blue');
	let catHours = $state(5);

	function openCategoryModal(catId) {
		if (catId) {
			const cat = $categories.find(c => c.id === catId);
			if (cat) {
				editingCatId = cat.id;
				catIcon = cat.icon || '';
				catName = cat.name || '';
				catColor = cat.color || 'blue';
				catHours = cat.weeklyHoursTarget || 5;
			}
		} else {
			editingCatId = null;
			catIcon = '';
			catName = '';
			catColor = 'blue';
			catHours = 5;
		}
		showCatModal = true;
	}

	function closeCatModal() {
		showCatModal = false;
		editingCatId = null;
	}

	function saveCategory() {
		const name = catName.trim();
		if (!name) {
			showToast('Name is required', 'warning');
			return;
		}

		if (editingCatId) {
			const idx = $categories.findIndex(c => c.id === editingCatId);
			if (idx !== -1) {
				$categories[idx].name = name;
				$categories[idx].icon = catIcon.trim();
				$categories[idx].color = catColor;
				$categories[idx].weeklyHoursTarget = catHours;
				$categories = $categories;
			}
			showToast('Category updated', 'success');
		} else {
			$categories = [...$categories, {
				id: 'cat_' + generateId(),
				name,
				icon: catIcon.trim(),
				color: catColor,
				weeklyHoursTarget: catHours
			}];
			showToast('Category added', 'success');
		}

		saveStore('categories', $categories);
		closeCatModal();
	}

	let showDeleteCatConfirm = $state(false);
	let deleteCatTarget = $state(null);

	function confirmDeleteCategory(catId) {
		deleteCatTarget = $categories.find(c => c.id === catId) || null;
		showDeleteCatConfirm = true;
	}

	function executeDeleteCategory() {
		if (deleteCatTarget) {
			$categories = $categories.filter(c => c.id !== deleteCatTarget.id);
			saveStore('categories', $categories);
			showToast('Category deleted', 'success');
		}
		showDeleteCatConfirm = false;
		deleteCatTarget = null;
	}

	// --- Data Management ---
	let syncing = $state(false);

	async function handleSync() {
		syncing = true;
		try {
			await syncAll();
			showToast('Data synced from cloud', 'success');
		} catch (e) {
			showToast('Sync failed: ' + e.message, 'error');
		}
		syncing = false;
	}

	function handleExport() {
		const blob = exportAll();
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'ethanos-backup-' + new Date().toISOString().split('T')[0] + '.json';
		a.click();
		URL.revokeObjectURL(url);
		showToast('Backup downloaded', 'success');
	}

	let fileInput;

	function handleImportClick() {
		fileInput?.click();
	}

	async function handleImportFile(e) {
		const file = e.target.files[0];
		if (!file) return;
		try {
			await importAll(file);
			showToast('Data imported successfully', 'success');
		} catch (err) {
			showToast('Import failed: ' + err.message, 'error');
		}
		e.target.value = '';
	}

	// --- Reset ---
	let showResetConfirm = $state(false);

	function handleReset() {
		showResetConfirm = true;
	}

	function executeReset() {
		try {
			const keysToRemove = [];
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key && key.indexOf('ethanos_') === 0) keysToRemove.push(key);
			}
			for (const key of keysToRemove) {
				localStorage.removeItem(key);
			}
			showToast('All data reset. Reloading...', 'success');
			showResetConfirm = false;
			setTimeout(() => { window.location.reload(); }, 1200);
		} catch (e) {
			showToast('Reset failed: ' + e.message, 'error');
		}
	}

	function getCatHex(color) {
		const map = { blue: '#45aaf2', purple: '#a78bfa', green: '#00d67e', orange: '#ffa502', pink: '#ff6b9d' };
		return map[color] || '#888';
	}
</script>

<svelte:head>
	<style>
		.settings-section { margin-bottom: var(--space-xl); }
		.settings-section-title {
			font-size: var(--font-size-lg);
			font-weight: 700;
			margin-bottom: var(--space-md);
			color: var(--text-primary);
		}
		.category-row {
			display: flex;
			align-items: center;
			gap: var(--space-md);
			padding: var(--space-md);
			border-radius: var(--border-radius-md);
			transition: background var(--transition-fast);
		}
		.category-row:hover { background: var(--accent-subtle); }
		.category-row + .category-row { border-top: 1px solid var(--border-subtle); }
		.category-swatch {
			width: 16px;
			height: 16px;
			border-radius: 4px;
			flex-shrink: 0;
		}
		.category-info { flex: 1; }
		.category-name { font-weight: 600; }
		.category-meta { font-size: var(--font-size-xs); color: var(--text-muted); }
		.setting-row {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: var(--space-md) 0;
			border-bottom: 1px solid var(--border-subtle);
		}
		.setting-label { font-weight: 600; }
		.setting-desc { font-size: var(--font-size-xs); color: var(--text-muted); margin-top: 2px; }
		.setting-control { display: flex; align-items: center; gap: var(--space-sm); }
		.setting-control input[type="range"] { width: 140px; }
		.danger-zone {
			border: 1px solid var(--danger);
			border-radius: var(--border-radius-lg);
			padding: var(--space-lg);
			background: var(--danger-bg);
		}
	</style>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">Settings</h1>
	<p class="page-subtitle">Customize your EthanOS experience</p>
</div>

<!-- Profile -->
<div class="card settings-section">
	<h2 class="settings-section-title">Profile</h2>
	<div class="form-group">
		<label class="form-label">User Name</label>
		<input type="text" value={$settings.userName || ''} placeholder="Your name" onchange={updateUserName} />
	</div>
</div>

<!-- Categories -->
<div class="card settings-section">
	<div class="flex-between mb-2">
		<h2 class="settings-section-title" style="margin-bottom:0">Categories</h2>
		<button class="btn btn-primary btn-sm" onclick={() => openCategoryModal(null)}>+ Add Category</button>
	</div>
	{#if $categories.length === 0}
		<p class="text-muted text-sm">No categories. Add one to get started.</p>
	{:else}
		{#each $categories as c}
			<div class="category-row">
				<div class="category-swatch" style="background:{getCatHex(c.color)}"></div>
				<span style="font-size:1.2rem">{c.icon || ''}</span>
				<div class="category-info">
					<div class="category-name">{c.name}</div>
					<div class="category-meta">{c.weeklyHoursTarget} hrs/week target</div>
				</div>
				<div class="btn-group">
					<button class="btn btn-sm btn-ghost" onclick={() => openCategoryModal(c.id)}>Edit</button>
					<button class="btn btn-sm btn-ghost text-danger" onclick={() => confirmDeleteCategory(c.id)}>Delete</button>
				</div>
			</div>
		{/each}
	{/if}
</div>

<!-- Focus Timer -->
<div class="card settings-section">
	<h2 class="settings-section-title">Focus Timer</h2>
	<div class="setting-row">
		<div>
			<div class="setting-label">Focus Duration</div>
			<div class="setting-desc">Length of each focus session in minutes</div>
		</div>
		<div class="setting-control">
			<input type="range" min="5" max="120" step="5" value={$settings.focusDuration || 25} onchange={updateFocusDuration} oninput={(e) => { e.target.nextElementSibling.textContent = e.target.value + ' min'; }} />
			<span class="text-sm text-accent" style="min-width:40px;text-align:right">{focusDisplay}</span>
		</div>
	</div>
	<div class="setting-row">
		<div>
			<div class="setting-label">Break Duration</div>
			<div class="setting-desc">Length of break between sessions in minutes</div>
		</div>
		<div class="setting-control">
			<input type="range" min="1" max="30" step="1" value={$settings.breakDuration || 5} onchange={updateBreakDuration} oninput={(e) => { e.target.nextElementSibling.textContent = e.target.value + ' min'; }} />
			<span class="text-sm text-accent" style="min-width:40px;text-align:right">{breakDisplay}</span>
		</div>
	</div>
</div>

<!-- Data Management -->
<div class="card settings-section">
	<h2 class="settings-section-title">Data Management</h2>
	<div class="setting-row">
		<div>
			<div class="setting-label">Cloud Sync</div>
			<div class="setting-desc">Sync all data with Supabase cloud database</div>
		</div>
		<button class="btn btn-sm" onclick={handleSync} disabled={syncing}>{syncing ? 'Syncing...' : 'Sync Now'}</button>
	</div>
	<div class="setting-row">
		<div>
			<div class="setting-label">Export Data</div>
			<div class="setting-desc">Download a JSON backup of all your data</div>
		</div>
		<button class="btn btn-sm" onclick={handleExport}>Export</button>
	</div>
	<div class="setting-row" style="border-bottom:none">
		<div>
			<div class="setting-label">Import Data</div>
			<div class="setting-desc">Restore from a JSON backup file</div>
		</div>
		<div>
			<input type="file" accept=".json" class="hidden" bind:this={fileInput} onchange={handleImportFile} />
			<button class="btn btn-sm" onclick={handleImportClick}>Import</button>
		</div>
	</div>
</div>

<!-- Danger Zone -->
<div class="danger-zone settings-section">
	<h2 class="settings-section-title text-danger">Danger Zone</h2>
	<p class="text-sm text-secondary mb-2">This will permanently delete all your EthanOS data and reset to defaults.</p>
	<button class="btn btn-danger" onclick={handleReset}>Reset All Data</button>
</div>

<!-- Category Modal -->
{#if showCatModal}
	<div class="modal-overlay" onclick={closeCatModal}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="modal" role="dialog" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3 class="modal-title">{editingCatId ? 'Edit Category' : 'Add Category'}</h3>
				<button class="btn btn-ghost btn-sm" onclick={closeCatModal}>&times;</button>
			</div>
			<div class="modal-body">
				<div class="form-group">
					<label class="form-label">Emoji Icon</label>
					<input type="text" bind:value={catIcon} placeholder="e.g. 📚" />
				</div>
				<div class="form-group">
					<label class="form-label">Name</label>
					<input type="text" bind:value={catName} placeholder="Category name" />
				</div>
				<div class="form-group">
					<label class="form-label">Color</label>
					<select bind:value={catColor}>
						{#each COLOR_OPTIONS as co}
							<option value={co.value}>{co.label}</option>
						{/each}
					</select>
				</div>
				<div class="form-group">
					<label class="form-label">Weekly Hours Target</label>
					<input type="number" min="0" max="168" bind:value={catHours} />
				</div>
				<div class="flex gap-2">
					<button class="btn btn-primary" onclick={saveCategory}>Save</button>
					<button class="btn" onclick={closeCatModal}>Cancel</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Delete Category Confirmation -->
{#if showDeleteCatConfirm && deleteCatTarget}
	<div class="modal-overlay" onclick={() => { showDeleteCatConfirm = false; }}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="modal" role="dialog" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3 class="modal-title">Delete Category</h3>
			</div>
			<div class="modal-body">
				<p>Delete <strong>{deleteCatTarget.icon} {deleteCatTarget.name}</strong>? This won't delete associated tasks or data.</p>
				<div class="flex gap-2 mt-3">
					<button class="btn btn-danger" onclick={executeDeleteCategory}>Delete</button>
					<button class="btn" onclick={() => { showDeleteCatConfirm = false; }}>Cancel</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Reset Confirmation -->
{#if showResetConfirm}
	<div class="modal-overlay" onclick={() => { showResetConfirm = false; }}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="modal" role="dialog" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3 class="modal-title">Reset All Data</h3>
			</div>
			<div class="modal-body">
				<p class="text-danger font-bold">This will permanently delete ALL your EthanOS data.</p>
				<p class="text-secondary text-sm mt-1">Categories, tasks, goals, notes, XP, settings -- everything will be reset to defaults.</p>
				<div class="flex gap-2 mt-3">
					<button class="btn btn-danger" onclick={executeReset}>Yes, Reset Everything</button>
					<button class="btn" onclick={() => { showResetConfirm = false; }}>Cancel</button>
				</div>
			</div>
		</div>
	</div>
{/if}
