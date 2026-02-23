<script>
	import { notes, categories, saveStore } from '$lib/stores/data.js';
	import { generateId, formatDate, timeAgo, getCategoryById, getCategoryColor } from '$lib/helpers.js';
	import { showToast } from '$lib/stores/toast.js';

	let selectedNoteId = $state(null);
	let activeTagFilter = $state(null);
	let searchValue = $state('');
	let filterCategory = $state('');
	let sortValue = $state('newest');

	// --- Tag cloud ---
	let allTags = $derived.by(() => {
		const tagSet = {};
		for (const n of $notes) {
			for (const t of (n.tags || [])) {
				if (t) tagSet[t.trim().toLowerCase()] = true;
			}
		}
		return Object.keys(tagSet).sort();
	});

	// --- Filtered & sorted notes ---
	let filteredNotes = $derived.by(() => {
		let result = [...$notes];
		const search = searchValue.toLowerCase().trim();

		if (search) {
			result = result.filter(n =>
				(n.title || '').toLowerCase().includes(search) ||
				(n.content || '').toLowerCase().includes(search) ||
				(n.tags || []).join(' ').toLowerCase().includes(search)
			);
		}

		if (filterCategory) {
			result = result.filter(n => n.categoryId === filterCategory);
		}

		if (activeTagFilter) {
			result = result.filter(n => {
				const tags = (n.tags || []).map(t => t.trim().toLowerCase());
				return tags.includes(activeTagFilter);
			});
		}

		if (sortValue === 'oldest') {
			result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
		} else if (sortValue === 'category') {
			result.sort((a, b) => (a.categoryId || '').localeCompare(b.categoryId || ''));
		} else {
			result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
		}

		return result;
	});

	// --- Selected note ---
	let selectedNote = $derived($notes.find(n => n.id === selectedNoteId) || null);

	// --- Editor state ---
	let editTitle = $state('');
	let editCategory = $state('');
	let editTags = $state('');
	let editContent = $state('');

	// Load note data into editor when selection changes
	$effect(() => {
		if (selectedNote) {
			editTitle = selectedNote.title || '';
			editCategory = selectedNote.categoryId || '';
			editTags = (selectedNote.tags || []).join(', ');
			editContent = selectedNote.content || '';
		}
	});

	// --- CRUD ---
	function createNewNote() {
		const note = {
			id: generateId(),
			title: 'New Note',
			content: '',
			categoryId: '',
			tags: [],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};
		$notes = [note, ...$notes];
		selectedNoteId = note.id;
		saveStore('notes', $notes);
		showToast('Note created', 'success');
	}

	function saveCurrentNote() {
		if (!selectedNoteId) return;
		const idx = $notes.findIndex(n => n.id === selectedNoteId);
		if (idx === -1) return;

		$notes[idx].title = editTitle.trim() || 'Untitled';
		$notes[idx].categoryId = editCategory;
		$notes[idx].content = editContent;
		$notes[idx].tags = editTags
			.split(',')
			.map(t => t.trim())
			.filter(t => t.length > 0);
		$notes[idx].updatedAt = new Date().toISOString();
		$notes = $notes;
		saveStore('notes', $notes);
		showToast('Note saved', 'success');
	}

	let showDeleteConfirm = $state(false);

	function deleteCurrentNote() {
		showDeleteConfirm = true;
	}

	function confirmDelete() {
		$notes = $notes.filter(n => n.id !== selectedNoteId);
		selectedNoteId = null;
		saveStore('notes', $notes);
		showDeleteConfirm = false;
		showToast('Note deleted', 'success');
	}

	function toggleTag(tag) {
		activeTagFilter = activeTagFilter === tag ? null : tag;
	}
</script>

<svelte:head>
	<style>
		.vault-layout {
			display: grid;
			grid-template-columns: 320px 1fr;
			gap: var(--space-lg);
			min-height: 60vh;
		}
		@media (max-width: 768px) {
			.vault-layout { grid-template-columns: 1fr; }
		}
		.vault-sidebar { display: flex; flex-direction: column; gap: var(--space-md); }
		.vault-filters { display: flex; gap: var(--space-sm); flex-wrap: wrap; }
		.note-list { flex: 1; overflow-y: auto; max-height: 65vh; }
		.note-item {
			padding: var(--space-md);
			border-radius: var(--border-radius-md);
			cursor: pointer;
			border: 1px solid transparent;
			transition: all var(--transition-fast);
			margin-bottom: var(--space-sm);
		}
		.note-item:hover { background: var(--accent-subtle); }
		.note-item.selected { border-color: var(--accent); background: var(--accent-subtle); }
		.note-item-title {
			font-weight: 600;
			font-size: var(--font-size-md);
			color: var(--text-primary);
			margin-bottom: var(--space-xs);
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.note-item-meta {
			font-size: var(--font-size-xs);
			color: var(--text-muted);
			display: flex;
			gap: var(--space-sm);
			align-items: center;
		}
		.note-tags { display: flex; gap: var(--space-xs); flex-wrap: wrap; margin-top: var(--space-xs); }
		.tag-pill {
			padding: 2px 8px;
			background: var(--bg-primary);
			border-radius: 12px;
			font-size: var(--font-size-xs);
			color: var(--text-secondary);
			cursor: pointer;
		}
		.tag-pill.active { background: var(--accent-subtle); color: var(--accent); }
		.editor-area { min-height: 300px; }
		.editor-tags-input { width: 100%; }
	</style>
</svelte:head>

<div class="page-header flex-between">
	<div>
		<h1 class="page-title">Knowledge Vault</h1>
		<p class="page-subtitle">Your personal knowledge base</p>
	</div>
	<div class="flex gap-2 items-center">
		<span class="text-sm text-muted">{$notes.length} note{$notes.length !== 1 ? 's' : ''}</span>
		<button class="btn btn-primary btn-sm" onclick={createNewNote}>+ New Note</button>
	</div>
</div>

<div class="vault-layout">
	<!-- Sidebar -->
	<div class="vault-sidebar">
		<input type="search" placeholder="Search notes..." bind:value={searchValue} />
		<div class="vault-filters">
			<select bind:value={filterCategory}>
				<option value="">All categories</option>
				{#each $categories as cat}
					<option value={cat.id}>{cat.icon} {cat.name}</option>
				{/each}
			</select>
			<select bind:value={sortValue}>
				<option value="newest">Newest</option>
				<option value="oldest">Oldest</option>
				<option value="category">Category</option>
			</select>
		</div>

		{#if allTags.length > 0}
			<div class="note-tags">
				{#each allTags as tag}
					<span class="tag-pill {activeTagFilter === tag ? 'active' : ''}" onclick={() => toggleTag(tag)}>{tag}</span>
				{/each}
			</div>
		{/if}

		<div class="note-list">
			{#if filteredNotes.length === 0}
				<div class="empty-state" style="padding:var(--space-xl)">
					<div class="empty-state-icon">&#128221;</div>
					<div class="empty-state-title">No notes found</div>
					<div class="empty-state-text">Create your first note or adjust your filters.</div>
				</div>
			{:else}
				{#each filteredNotes as n}
					{@const cat = getCategoryById($categories, n.categoryId)}
					{@const catColor = getCategoryColor($categories, n.categoryId)}
					<div
						class="note-item {n.id === selectedNoteId ? 'selected' : ''}"
						onclick={() => { selectedNoteId = n.id; }}
					>
						<div class="note-item-title">{n.title || 'Untitled'}</div>
						<div class="note-item-meta">
							{#if cat}
								<span class="badge" style="background:{catColor}22;color:{catColor};font-size:var(--font-size-xs);padding:1px 6px">{cat.icon} {cat.name}</span>
							{/if}
							<span>{timeAgo(n.updatedAt || n.createdAt)}</span>
						</div>
						{#if n.tags && n.tags.length > 0}
							<div class="note-tags">
								{#each n.tags as tag}
									{#if tag}
										<span class="tag-pill">{tag}</span>
									{/if}
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	</div>

	<!-- Editor Panel -->
	<div class="card">
		{#if !selectedNote}
			<div class="empty-state" style="padding:var(--space-2xl)">
				<div class="empty-state-icon">&#128196;</div>
				<div class="empty-state-title">Select a note</div>
				<div class="empty-state-text">Choose a note from the list or create a new one.</div>
			</div>
		{:else}
			<div style="padding:var(--space-lg)">
				<div class="form-group">
					<label class="form-label">Title</label>
					<input type="text" bind:value={editTitle} />
				</div>
				<div class="grid-2">
					<div class="form-group">
						<label class="form-label">Category</label>
						<select bind:value={editCategory}>
							<option value="">No category</option>
							{#each $categories as cat}
								<option value={cat.id}>{cat.icon} {cat.name}</option>
							{/each}
						</select>
					</div>
					<div class="form-group">
						<label class="form-label">Tags (comma-separated)</label>
						<input type="text" class="editor-tags-input" bind:value={editTags} />
					</div>
				</div>
				<div class="form-group">
					<label class="form-label">Content</label>
					<textarea class="editor-area" bind:value={editContent}></textarea>
				</div>
				<div class="flex gap-2">
					<button class="btn btn-primary" onclick={saveCurrentNote}>Save</button>
					<button class="btn btn-danger" onclick={deleteCurrentNote}>Delete</button>
				</div>
				<div class="text-xs text-muted mt-2">
					Created {formatDate(selectedNote.createdAt)}
					{#if selectedNote.updatedAt}
						&middot; Updated {timeAgo(selectedNote.updatedAt)}
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm}
	<div class="modal-overlay" onclick={() => { showDeleteConfirm = false; }}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="modal" role="dialog" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3 class="modal-title">Delete Note</h3>
			</div>
			<div class="modal-body">
				<p>Are you sure you want to delete this note? This cannot be undone.</p>
				<div class="flex gap-2 mt-3">
					<button class="btn btn-danger" onclick={confirmDelete}>Delete</button>
					<button class="btn" onclick={() => { showDeleteConfirm = false; }}>Cancel</button>
				</div>
			</div>
		</div>
	</div>
{/if}
