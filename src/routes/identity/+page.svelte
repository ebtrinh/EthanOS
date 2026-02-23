<script>
	import { identityStatements, goals, categories, saveStore } from '$lib/stores/data.js';
	import { generateId, getCategoryById, getCategoryColor } from '$lib/helpers.js';
	import { showToast } from '$lib/stores/toast.js';

	// --- Daily Spotlight ---
	let spotlightStatement = $derived.by(() => {
		if ($identityStatements.length === 0) return null;
		const today = new Date().toISOString().slice(0, 10);
		let seed = 0;
		for (let i = 0; i < today.length; i++) seed += today.charCodeAt(i);
		const idx = seed % $identityStatements.length;
		return $identityStatements[idx];
	});

	let spotlightCategory = $derived(spotlightStatement ? getCategoryById($categories, spotlightStatement.categoryId) : null);

	// --- Statement data with linked goals ---
	let statementsWithGoals = $derived.by(() => {
		return $identityStatements.map(s => {
			const cat = getCategoryById($categories, s.categoryId);
			const catColor = getCategoryColor($categories, s.categoryId);
			const linkedGoals = $goals.filter(g => g.categoryId === s.categoryId);
			return { ...s, cat, catColor, linkedGoals };
		});
	});

	// --- Modal state ---
	let showModal = $state(false);
	let editingStatement = $state(null);
	let formText = $state('');
	let formCategoryId = $state('');

	function openStatementForm(stmt) {
		editingStatement = stmt;
		formText = stmt ? stmt.statement : '';
		formCategoryId = stmt ? stmt.categoryId || '' : '';
		showModal = true;
	}

	function closeStatementForm() {
		showModal = false;
		editingStatement = null;
		formText = '';
		formCategoryId = '';
	}

	function saveStatement() {
		const text = formText.trim();
		if (!text) {
			showToast('Statement is required', 'warning');
			return;
		}

		if (editingStatement) {
			const idx = $identityStatements.findIndex(s => s.id === editingStatement.id);
			if (idx !== -1) {
				$identityStatements[idx].statement = text;
				$identityStatements[idx].categoryId = formCategoryId;
				$identityStatements = $identityStatements;
			}
			showToast('Statement updated', 'success');
		} else {
			$identityStatements = [...$identityStatements, {
				id: generateId(),
				statement: text,
				categoryId: formCategoryId
			}];
			showToast('Statement added', 'success');
		}

		saveStore('identityStatements', $identityStatements);
		closeStatementForm();
	}

	function deleteStatement(id) {
		$identityStatements = $identityStatements.filter(s => s.id !== id);
		saveStore('identityStatements', $identityStatements);
		showToast('Statement deleted', 'info');
	}
</script>

<div class="page-header flex-between">
	<div>
		<h1 class="page-title">Identity System</h1>
		<p class="page-subtitle">Define who you are becoming</p>
	</div>
	<button class="btn btn-primary" onclick={() => openStatementForm(null)}>+ Add Statement</button>
</div>

<!-- Daily Spotlight -->
<div class="card card-glow mb-3">
	<div class="card-header">
		<h2 class="card-title">Daily Spotlight</h2>
	</div>
	<div class="card-body" style="text-align:center;padding:var(--space-xl)">
		{#if !spotlightStatement}
			<p class="text-muted">Add identity statements to see your daily spotlight</p>
		{:else}
			<div style="font-size:var(--font-size-xl);font-weight:700;color:var(--text-primary);margin-bottom:var(--space-md)">
				"You are becoming someone who {spotlightStatement.statement}"
			</div>
			{#if spotlightCategory}
				<span class="badge" style="background:{getCategoryColor($categories, spotlightStatement.categoryId)}22;color:{getCategoryColor($categories, spotlightStatement.categoryId)}">
					{spotlightCategory.icon} {spotlightCategory.name}
				</span>
			{/if}
		{/if}
	</div>
</div>

<!-- Statements List -->
<div class="grid-dashboard">
	{#if $identityStatements.length === 0}
		<div class="empty-state span-full">
			<div class="empty-state-icon">🧬</div>
			<div class="empty-state-title">No identity statements yet</div>
			<div class="empty-state-text">Define who you are becoming by adding statements.</div>
		</div>
	{:else}
		{#each statementsWithGoals as s}
			<div class="card">
				<div class="card-header">
					<div>
						{#if s.cat}
							<span class="badge" style="background:{s.catColor}22;color:{s.catColor}">{s.cat.icon} {s.cat.name}</span>
						{:else}
							<span class="badge badge-muted">No category</span>
						{/if}
					</div>
					<div class="btn-group">
						<button class="btn btn-ghost btn-sm" onclick={() => openStatementForm(s)}>Edit</button>
						<button class="btn btn-ghost btn-sm text-danger" onclick={() => deleteStatement(s.id)}>Delete</button>
					</div>
				</div>
				<div class="card-body">
					<p style="font-size:var(--font-size-md);font-weight:600;color:var(--text-primary)">"You are becoming someone who {s.statement}"</p>
					{#if s.linkedGoals.length > 0}
						{#each s.linkedGoals as goal}
							<div style="margin-top:var(--space-sm)">
								<div class="progress-label">
									<span class="progress-label-name">{goal.title}</span>
									<span class="progress-label-value">{goal.progress || 0}%</span>
								</div>
								<div class="progress-bar">
									<div class="progress-bar-fill" style="width:{goal.progress || 0}%"></div>
								</div>
							</div>
						{/each}
					{:else}
						<p class="text-xs text-muted" style="margin-top:var(--space-sm)">No linked goals</p>
					{/if}
				</div>
			</div>
		{/each}
	{/if}
</div>

<!-- Statement Modal -->
{#if showModal}
	<div class="modal-overlay" onclick={closeStatementForm}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="modal" role="dialog" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3 class="modal-title">{editingStatement ? 'Edit Statement' : 'Add Identity Statement'}</h3>
				<button class="btn btn-ghost btn-sm" onclick={closeStatementForm}>&times;</button>
			</div>
			<div class="modal-body">
				<div class="form-group">
					<label class="form-label">You are becoming someone who...</label>
					<textarea rows="3" placeholder="e.g., studies consistently every day" bind:value={formText}></textarea>
				</div>
				<div class="form-group">
					<label class="form-label">Category</label>
					<select bind:value={formCategoryId}>
						<option value="">-- None --</option>
						{#each $categories as cat}
							<option value={cat.id}>{cat.icon} {cat.name}</option>
						{/each}
					</select>
				</div>
				<div style="display:flex;justify-content:flex-end;gap:var(--space-sm);margin-top:var(--space-lg)">
					<button class="btn" onclick={closeStatementForm}>Cancel</button>
					<button class="btn btn-primary" onclick={saveStatement}>{editingStatement ? 'Update' : 'Add Statement'}</button>
				</div>
			</div>
		</div>
	</div>
{/if}
