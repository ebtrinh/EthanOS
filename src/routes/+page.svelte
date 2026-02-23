<script>
	import { categories, tasks, schedule, focusSessions, xp, saveStore } from '$lib/stores/data.js';
	import {
		generateId,
		formatDate,
		formatTime,
		getCategoryById,
		getCategoryColor,
		COLOR_MAP,
		BADGE_CLASS_MAP,
		awardXP
	} from '$lib/helpers.js';
	import { showToast } from '$lib/stores/toast.js';
	import CategoryBadge from '$lib/components/CategoryBadge.svelte';

	/* ---- Clock ---- */
	let currentTime = $state('--:--');

	function tick() {
		const now = new Date();
		let h = now.getHours();
		const m = now.getMinutes();
		const ampm = h >= 12 ? 'PM' : 'AM';
		h = h % 12 || 12;
		currentTime = h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
	}

	$effect(() => {
		tick();
		const interval = setInterval(tick, 5000);
		return () => clearInterval(interval);
	});

	/* ---- Free Time Today ---- */
	function parseTimeToday(timeStr) {
		const parts = timeStr.split(':');
		const d = new Date();
		d.setHours(parseInt(parts[0]) || 0, parseInt(parts[1]) || 0, 0, 0);
		return d;
	}

	let freeTimeText = $derived.by(() => {
		const today = new Date();
		const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][today.getDay()];
		const todayStr = today.toISOString().split('T')[0];
		const totalDayMinutes = 17 * 60;
		let scheduledMinutes = 0;

		for (const item of $schedule) {
			let isToday = false;
			if (item.recurring && item.days && item.days.indexOf(dayName) !== -1) {
				isToday = true;
			} else if (item.startTime && item.startTime.indexOf(todayStr) === 0) {
				isToday = true;
			}

			if (isToday && item.startTime && item.endTime) {
				let start = new Date(item.startTime);
				let end = new Date(item.endTime);
				if (item.recurring) {
					const parts = item.startTime.split('T');
					const endParts = item.endTime.split('T');
					if (parts.length > 1 && endParts.length > 1) {
						start = parseTimeToday(parts[1]);
						end = parseTimeToday(endParts[1]);
					}
				}
				const dur = (end - start) / 60000;
				if (dur > 0) scheduledMinutes += dur;
			}
		}

		const freeMinutes = Math.max(0, totalDayMinutes - scheduledMinutes);
		const freeH = Math.floor(freeMinutes / 60);
		const freeM = freeMinutes % 60;
		return freeH + 'h ' + freeM + 'm';
	});

	/* ---- Priority Tasks (top 3) ---- */
	let incompleteTasks = $derived(
		($tasks || [])
			.filter((t) => !t.completed)
			.sort((a, b) => {
				const dA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
				const dB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
				if (dA !== dB) return dA - dB;
				return (b.difficulty || 0) - (a.difficulty || 0);
			})
	);

	let top3 = $derived(incompleteTasks.slice(0, 3));

	function getDueBadge(task) {
		if (!task.dueDate) return null;
		const now = new Date();
		const due = new Date(task.dueDate);
		const diffDays = Math.ceil((due - now) / 86400000);
		if (diffDays < 0) return { cls: 'badge-danger', text: 'Overdue' };
		if (diffDays <= 2) return { cls: 'badge-warning', text: 'Due soon' };
		return null;
	}

	/* ---- Deadline Countdown ---- */
	let nextDeadline = $derived.by(() => {
		const now = new Date();
		let nextTask = null;
		let nearestDue = Infinity;

		for (const t of $tasks || []) {
			if (t.completed || !t.dueDate) continue;
			const due = new Date(t.dueDate).getTime();
			if (due > now.getTime() && due < nearestDue) {
				nearestDue = due;
				nextTask = t;
			}
		}

		if (!nextTask) return { countdown: '--', name: 'No upcoming deadlines' };

		const diffMs = nearestDue - now.getTime();
		const days = Math.floor(diffMs / 86400000);
		const hours = Math.floor((diffMs % 86400000) / 3600000);
		const countdown = days > 0 ? days + 'd ' + hours + 'h' : hours + 'h';

		return { countdown, name: nextTask.title };
	});

	/* ---- Streaks ---- */
	function calcStreak(sessions) {
		if (!sessions || sessions.length === 0) return 0;
		const dates = {};
		for (const s of sessions) {
			const d = new Date(s.startTime || s.endTime);
			dates[d.toISOString().split('T')[0]] = true;
		}
		const today = new Date();
		let streak = 0;
		for (let d = 0; d < 365; d++) {
			const check = new Date(today);
			check.setDate(check.getDate() - d);
			const key = check.toISOString().split('T')[0];
			if (dates[key]) {
				streak++;
			} else {
				if (d === 0) continue;
				break;
			}
		}
		return streak;
	}

	let streakData = $derived.by(() => {
		const storedStreaks = ($xp && $xp.streaks) || {};
		const catIds = Object.keys(storedStreaks);

		if (catIds.length > 0) {
			return catIds.map((catId) => {
				const cat = getCategoryById($categories, catId);
				const color = getCategoryColor($categories, catId);
				const val = storedStreaks[catId] || 0;
				return { catId, cat, color, streak: val };
			});
		}

		// Build from focus sessions
		const sessionsByCategory = {};
		for (const s of $focusSessions || []) {
			if (!s.categoryId) continue;
			if (!sessionsByCategory[s.categoryId]) sessionsByCategory[s.categoryId] = [];
			sessionsByCategory[s.categoryId].push(s);
		}

		const catKeys = Object.keys(sessionsByCategory);
		if (catKeys.length === 0) return [];

		return catKeys.map((catId) => {
			const cat = getCategoryById($categories, catId);
			const color = getCategoryColor($categories, catId);
			const streak = calcStreak(sessionsByCategory[catId]);
			return { catId, cat, color, streak };
		});
	});

	/* ---- Mini Timeline ---- */
	let todaySchedule = $derived.by(() => {
		const today = new Date();
		const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][today.getDay()];
		const todayStr = today.toISOString().split('T')[0];

		const todayItems = [];
		for (const item of $schedule) {
			let isToday = false;
			if (item.recurring && item.days && item.days.indexOf(dayName) !== -1) {
				isToday = true;
			} else if (item.startTime && item.startTime.indexOf(todayStr) === 0) {
				isToday = true;
			}
			if (isToday) todayItems.push(item);
		}

		todayItems.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
		return todayItems;
	});

	/* ---- Quick Add Form ---- */
	let qaTitle = $state('');
	let qaCategory = $state('');
	let qaDifficulty = $state(3);
	let qaDue = $state('');
	let qaMinutes = $state('');

	// Default category from first item
	$effect(() => {
		if ($categories.length > 0 && !qaCategory) {
			qaCategory = $categories[0].id;
		}
	});

	async function handleQuickAdd(e) {
		e.preventDefault();
		if (!qaTitle.trim()) return;

		const newTask = {
			id: generateId(),
			title: qaTitle.trim(),
			categoryId: qaCategory,
			difficulty: parseInt(qaDifficulty) || 3,
			dueDate: qaDue || null,
			estimatedMinutes: qaMinutes ? parseInt(qaMinutes) : null,
			completed: false,
			actualMinutes: null,
			completedAt: null,
			createdAt: new Date().toISOString()
		};

		$tasks = [...$tasks, newTask];
		await saveStore('tasks', $tasks);

		showToast('Task added: ' + qaTitle.trim(), 'success');
		qaTitle = '';
		qaDue = '';
		qaMinutes = '';
		qaDifficulty = 3;
	}

	/* ---- Star rating helper ---- */
	function starArray(rating, max = 5) {
		return Array.from({ length: max }, (_, i) => i < rating);
	}
</script>

<div class="page-header">
	<h1 class="page-title">Command Center</h1>
	<p class="page-subtitle">Your day at a glance</p>
</div>

<!-- Top stats row -->
<div class="grid-stats mb-3">
	<div class="card stat-card">
		<div class="stat-number accent">{currentTime}</div>
		<div class="stat-label">Current Time</div>
	</div>
	<div class="card stat-card">
		<div class="stat-number success">{freeTimeText}</div>
		<div class="stat-label">Free Today</div>
	</div>
	<div class="card stat-card">
		<div class="stat-number warning">{nextDeadline.countdown}</div>
		<div class="stat-label">Next Deadline</div>
		<div class="stat-sublabel">{nextDeadline.name}</div>
	</div>
</div>

<div class="grid-dashboard">
	<!-- Priority Tasks -->
	<div class="card">
		<div class="card-header">
			<h2 class="card-title">Priority Tasks</h2>
			<span class="badge badge-info">{incompleteTasks.length} pending</span>
		</div>
		<div class="card-body">
			{#if top3.length === 0}
				<div class="empty-state">
					<div class="empty-state-icon">&#9989;</div>
					<div class="empty-state-title">All clear!</div>
					<div class="empty-state-text">No pending tasks. Add one below.</div>
				</div>
			{:else}
				{#each top3 as t (t.id)}
					{@const badge = getDueBadge(t)}
					{@const due = t.dueDate ? new Date(t.dueDate) : null}
					<div class="list-item">
						<div class="flex-1">
							<div class="flex items-center gap-1">
								<strong>{t.title}</strong>
								{#if badge}
									<span class="badge {badge.cls}">{badge.text}</span>
								{/if}
							</div>
							<div class="flex items-center gap-1 mt-1 text-sm text-secondary">
								<CategoryBadge categoryId={t.categoryId} />
								<div class="star-rating">
									{#each starArray(t.difficulty || 1) as filled}
										<span class="star{filled ? ' filled' : ''}">&#9733;</span>
									{/each}
								</div>
								{#if due}
									<span class="text-muted">{formatDate(due)}</span>
								{/if}
								{#if t.estimatedMinutes}
									<span class="text-muted">{t.estimatedMinutes} min</span>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>

	<!-- Streak Tracker -->
	<div class="card">
		<div class="card-header">
			<h2 class="card-title">Streaks</h2>
		</div>
		<div class="card-body">
			{#if streakData.length === 0}
				<div class="empty-state">
					<div class="empty-state-icon">&#128293;</div>
					<div class="empty-state-title">No streaks yet</div>
					<div class="empty-state-text">Complete focus sessions to build streaks</div>
				</div>
			{:else}
				{#each streakData as s (s.catId)}
					<div class="list-item">
						<span style="color:{s.color};font-size:1.2rem">{s.cat ? s.cat.icon : ''}</span>
						<div class="flex-1">
							<div class="font-bold">{s.cat ? s.cat.name : s.catId}</div>
							<div class="text-sm text-secondary">{s.streak} day streak</div>
						</div>
						<span class="badge" style="background:{s.color}22;color:{s.color}">{s.streak}d</span>
					</div>
				{/each}
			{/if}
		</div>
	</div>

	<!-- Today's Schedule Mini-Timeline -->
	<div class="card">
		<div class="card-header">
			<h2 class="card-title">Today's Schedule</h2>
		</div>
		<div class="card-body">
			{#if todaySchedule.length === 0}
				<div class="empty-state">
					<div class="empty-state-icon">&#128197;</div>
					<div class="empty-state-title">Nothing scheduled</div>
					<div class="empty-state-text">Add schedule items to see your day</div>
				</div>
			{:else}
				<div style="position:relative;padding-left:16px;border-left:2px solid var(--border-color)">
					{#each todaySchedule as s (s.id)}
						{@const color = getCategoryColor($categories, s.categoryId)}
						<div style="margin-bottom:var(--space-md);position:relative">
							<div
								style="position:absolute;left:-21px;top:4px;width:10px;height:10px;border-radius:50%;background:{color}"
							></div>
							<div class="text-xs text-muted">
								{s.startTime ? formatTime(s.startTime) : ''}{s.endTime
									? ' - ' + formatTime(s.endTime)
									: ''}
							</div>
							<div class="font-bold text-sm" style="color:{color}">{s.title}</div>
							<CategoryBadge categoryId={s.categoryId} />
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Quick Add Task -->
	<div class="card span-full">
		<div class="card-header">
			<h2 class="card-title">Quick Add Task</h2>
		</div>
		<div class="card-body">
			<form class="flex flex-wrap gap-2 items-center" onsubmit={handleQuickAdd}>
				<div class="flex-1" style="min-width:180px">
					<input type="text" bind:value={qaTitle} placeholder="Task title..." required />
				</div>
				<div style="min-width:140px">
					<select bind:value={qaCategory}>
						{#each $categories as cat (cat.id)}
							<option value={cat.id}>{cat.icon} {cat.name}</option>
						{/each}
					</select>
				</div>
				<div style="min-width:100px">
					<select bind:value={qaDifficulty}>
						<option value={1}>1 Star</option>
						<option value={2}>2 Stars</option>
						<option value={3}>3 Stars</option>
						<option value={4}>4 Stars</option>
						<option value={5}>5 Stars</option>
					</select>
				</div>
				<div style="min-width:140px">
					<input type="date" bind:value={qaDue} />
				</div>
				<div style="min-width:100px">
					<input type="number" bind:value={qaMinutes} placeholder="Est. min" min="1" max="600" />
				</div>
				<button type="submit" class="btn btn-primary">Add Task</button>
			</form>
		</div>
	</div>
</div>
