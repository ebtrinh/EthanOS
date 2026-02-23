<script>
	import { categories, tasks, xp, saveStore } from '$lib/stores/data.js';
	import {
		generateId,
		formatDate,
		getCategoryById,
		getCategoryColor,
		COLOR_MAP,
		BADGE_CLASS_MAP,
		awardXP
	} from '$lib/helpers.js';
	import { showToast } from '$lib/stores/toast.js';
	import { openModal, closeModal } from '$lib/stores/modal.js';
	import CategoryBadge from '$lib/components/CategoryBadge.svelte';

	/* ---- Filters & sort state ---- */
	let currentSort = $state('dueDate');
	let currentFilter = $state('all');

	/* ---- Task modal state ---- */
	let showTaskModal = $state(false);
	let editingTask = $state(null);
	let tfTitle = $state('');
	let tfCategory = $state('');
	let tfDifficulty = $state(3);
	let tfMinutes = $state('');
	let tfDue = $state('');

	/* ---- Filtered + sorted tasks ---- */
	let filteredTasks = $derived.by(() => {
		let filtered = ($tasks || []).slice();

		if (currentFilter !== 'all') {
			filtered = filtered.filter((t) => t.categoryId === currentFilter);
		}

		filtered.sort((a, b) => {
			if (currentSort === 'dueDate') {
				const dA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
				const dB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
				return dA - dB;
			} else if (currentSort === 'difficulty') {
				return (b.difficulty || 0) - (a.difficulty || 0);
			} else if (currentSort === 'estimate') {
				return (a.estimatedMinutes || 0) - (b.estimatedMinutes || 0);
			}
			return 0;
		});

		return filtered;
	});

	/* ---- Count badges ---- */
	let overdue = $derived.by(() => {
		const now = new Date();
		return ($tasks || []).filter((t) => {
			if (t.completed || !t.dueDate) return false;
			return Math.ceil((new Date(t.dueDate) - now) / 86400000) < 0;
		}).length;
	});

	let dueSoon = $derived.by(() => {
		const now = new Date();
		return ($tasks || []).filter((t) => {
			if (t.completed || !t.dueDate) return false;
			const diff = Math.ceil((new Date(t.dueDate) - now) / 86400000);
			return diff >= 0 && diff <= 2;
		}).length;
	});

	let completedCount = $derived(($tasks || []).filter((t) => t.completed).length);

	/* ---- Helpers ---- */
	function getDueBadge(task) {
		if (task.completed) return { cls: 'badge-success', text: 'Completed' };
		if (!task.dueDate) return null;
		const now = new Date();
		const diff = Math.ceil((new Date(task.dueDate) - now) / 86400000);
		if (diff < 0) return { cls: 'badge-danger', text: 'Overdue' };
		if (diff <= 2) return { cls: 'badge-warning', text: 'Due soon' };
		return null;
	}

	function starArray(rating, max = 5) {
		return Array.from({ length: max }, (_, i) => i < rating);
	}

	/* ---- Task Modal ---- */
	function openTaskModal(task) {
		editingTask = task || null;
		tfTitle = task ? task.title : '';
		tfCategory = task ? task.categoryId : ($categories.length > 0 ? $categories[0].id : '');
		tfDifficulty = task ? (task.difficulty || 3) : 3;
		tfMinutes = task && task.estimatedMinutes ? String(task.estimatedMinutes) : '';
		tfDue = task && task.dueDate ? task.dueDate.split('T')[0] : '';
		showTaskModal = true;
	}

	function closeTaskModal() {
		showTaskModal = false;
		editingTask = null;
	}

	async function handleTaskSubmit(e) {
		e.preventDefault();
		if (!tfTitle.trim()) return;

		if (editingTask) {
			$tasks = $tasks.map((t) => {
				if (t.id === editingTask.id) {
					return {
						...t,
						title: tfTitle.trim(),
						categoryId: tfCategory,
						difficulty: parseInt(tfDifficulty) || 3,
						estimatedMinutes: tfMinutes ? parseInt(tfMinutes) : null,
						dueDate: tfDue || null
					};
				}
				return t;
			});
			await saveStore('tasks', $tasks);
			showToast('Task updated', 'success');
		} else {
			const newTask = {
				id: generateId(),
				title: tfTitle.trim(),
				categoryId: tfCategory,
				difficulty: parseInt(tfDifficulty) || 3,
				estimatedMinutes: tfMinutes ? parseInt(tfMinutes) : null,
				dueDate: tfDue || null,
				completed: false,
				actualMinutes: null,
				completedAt: null,
				createdAt: new Date().toISOString()
			};
			$tasks = [...$tasks, newTask];
			await saveStore('tasks', $tasks);
			showToast('Task added', 'success');
		}
		closeTaskModal();
	}

	/* ---- Actions ---- */
	async function completeTask(id) {
		$tasks = $tasks.map((t) => {
			if (t.id === id) {
				return { ...t, completed: true, completedAt: new Date().toISOString() };
			}
			return t;
		});
		await saveStore('tasks', $tasks);
		const result = awardXP(xp, 50, 'Task completed');
		await saveStore('xp', $xp);
		showToast('+50 XP - Task completed', 'success');
		if (result && result.leveledUp) {
			showToast('Level up! You are now ' + result.newLevel + '!', 'success');
		}
	}

	function editTask(id) {
		const task = ($tasks || []).find((t) => t.id === id);
		if (task) openTaskModal(task);
	}

	async function deleteTask(id) {
		$tasks = $tasks.filter((t) => t.id !== id);
		await saveStore('tasks', $tasks);
		showToast('Task deleted', 'warning');
	}
</script>

<div class="page-header flex-between">
	<div>
		<h1 class="page-title">Academic Brain</h1>
		<p class="page-subtitle">Manage all your tasks and assignments</p>
	</div>
	<button class="btn btn-primary" onclick={() => openTaskModal(null)}>+ Add Task</button>
</div>

<!-- Controls -->
<div class="flex flex-wrap gap-2 mb-3 items-center">
	<div style="min-width:160px">
		<select bind:value={currentSort}>
			<option value="dueDate">Sort: Due Date</option>
			<option value="difficulty">Sort: Difficulty</option>
			<option value="estimate">Sort: Time Estimate</option>
		</select>
	</div>
	<div style="min-width:160px">
		<select bind:value={currentFilter}>
			<option value="all">All Categories</option>
			{#each $categories as cat (cat.id)}
				<option value={cat.id}>{cat.icon} {cat.name}</option>
			{/each}
		</select>
	</div>
	<div class="flex-1"></div>
	<div class="flex gap-1 items-center">
		<span class="badge badge-danger">{overdue} overdue</span>
		<span class="badge badge-warning">{dueSoon} due soon</span>
		<span class="badge badge-success">{completedCount} completed</span>
	</div>
</div>

<!-- Task List -->
<div>
	{#if filteredTasks.length === 0}
		<div class="card">
			<div class="empty-state">
				<div class="empty-state-icon">&#128218;</div>
				<div class="empty-state-title">No tasks found</div>
				<div class="empty-state-text">Click "Add Task" to create your first task</div>
			</div>
		</div>
	{:else}
		{#each filteredTasks as t (t.id)}
			{@const badge = getDueBadge(t)}
			{@const due = t.dueDate ? new Date(t.dueDate) : null}
			<div
				class="card{t.completed ? '' : ' card-clickable'}"
				style="margin-bottom:var(--space-md);{t.completed ? 'opacity:0.6' : ''}"
			>
				<div class="flex items-center gap-2">
					<div class="flex-1">
						<div class="flex items-center gap-1 flex-wrap">
							<strong style={t.completed ? 'text-decoration:line-through' : ''}
								>{t.title}</strong
							>
							{#if badge}
								<span class="badge {badge.cls}">{badge.text}</span>
							{/if}
							<CategoryBadge categoryId={t.categoryId} />
						</div>
						<div class="flex items-center gap-2 mt-1 text-sm">
							<div class="star-rating">
								{#each starArray(t.difficulty || 1) as filled}
									<span class="star{filled ? ' filled' : ''}">&#9733;</span>
								{/each}
							</div>
							{#if t.estimatedMinutes}
								<span class="text-muted">{t.estimatedMinutes} min</span>
							{/if}
							{#if due}
								<span class="text-muted">{formatDate(due)}</span>
							{/if}
						</div>
					</div>
					<div class="btn-group">
						{#if !t.completed}
							<button class="btn btn-sm btn-success" onclick={() => completeTask(t.id)}
								>Done</button
							>
						{/if}
						<button class="btn btn-sm btn-ghost" onclick={() => editTask(t.id)}>Edit</button>
						<button class="btn btn-sm btn-danger" onclick={() => deleteTask(t.id)}>Del</button>
					</div>
				</div>
			</div>
		{/each}
	{/if}
</div>

<!-- Task Modal -->
{#if showTaskModal}
	<div class="modal-overlay visible" role="dialog" onclick={(e) => { if (e.target === e.currentTarget) closeTaskModal(); }}>
		<div class="modal">
			<div class="modal-header">
				<h2 class="modal-title">{editingTask ? 'Edit Task' : 'Add Task'}</h2>
				<button class="modal-close" aria-label="Close" onclick={closeTaskModal}>&times;</button>
			</div>
			<div class="modal-body">
				<form onsubmit={handleTaskSubmit}>
					<div class="form-group">
						<label class="form-label">Title</label>
						<input type="text" bind:value={tfTitle} required />
					</div>
					<div class="form-group">
						<label class="form-label">Category</label>
						<select bind:value={tfCategory}>
							{#each $categories as cat (cat.id)}
								<option value={cat.id}>{cat.icon} {cat.name}</option>
							{/each}
						</select>
					</div>
					<div class="grid-2">
						<div class="form-group">
							<label class="form-label">Difficulty</label>
							<select bind:value={tfDifficulty}>
								{#each [1, 2, 3, 4, 5] as d}
									<option value={d}>{d} Star{d > 1 ? 's' : ''}</option>
								{/each}
							</select>
						</div>
						<div class="form-group">
							<label class="form-label">Estimated Minutes</label>
							<input type="number" bind:value={tfMinutes} min="1" max="600" />
						</div>
					</div>
					<div class="form-group">
						<label class="form-label">Due Date</label>
						<input type="date" bind:value={tfDue} />
					</div>
					<div class="flex gap-1" style="justify-content:flex-end">
						<button type="button" class="btn" onclick={closeTaskModal}>Cancel</button>
						<button type="submit" class="btn btn-primary"
							>{editingTask ? 'Save Changes' : 'Add Task'}</button
						>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}
