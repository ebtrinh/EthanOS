<script>
	import { categories, tasks, goals, focusSessions, settings, xp, saveStore } from '$lib/stores/data.js';
	import { generateId, timeAgo, awardXP } from '$lib/helpers.js';
	import { showToast } from '$lib/stores/toast.js';
	import CategoryBadge from '$lib/components/CategoryBadge.svelte';
	import StarRating from '$lib/components/StarRating.svelte';

	// Timer state
	let timerInterval = $state(null);
	let timerRunning = $state(false);
	let timerPaused = $state(false);
	let timerSecondsRemaining = $state(($settings.focusDuration || 25) * 60);
	let sessionStartTime = $state(null);

	// Form state
	let selectedTaskId = $state('');
	let selectedCategoryId = $state($categories[0]?.id || '');
	let sessionDuration = $state($settings.focusDuration || 25);

	// Post-session modal state
	let showPostSession = $state(false);
	let sessionElapsed = $state(0);
	let psDifficulty = $state(3);
	let psDistractions = $state(0);
	let psNotes = $state('');

	// Derived values
	let incompleteTasks = $derived($tasks.filter((t) => !t.completed));

	let timerDisplay = $derived.by(() => {
		const mins = Math.floor(timerSecondsRemaining / 60);
		const secs = timerSecondsRemaining % 60;
		return (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
	});

	let timerColor = $derived.by(() => {
		if (timerSecondsRemaining <= 60 && timerRunning) return 'var(--danger)';
		if (timerSecondsRemaining <= 300 && timerRunning) return 'var(--warning)';
		return 'var(--accent)';
	});

	let whyMatters = $derived.by(() => {
		if (!selectedTaskId) return null;
		const task = $tasks.find((t) => t.id === selectedTaskId);
		if (!task) return null;

		let linkedGoal = null;
		if (task.goalId) {
			linkedGoal = $goals.find((g) => g.id === task.goalId);
		}
		if (!linkedGoal) {
			linkedGoal = $goals.find((g) => g.categoryId === task.categoryId);
		}

		if (linkedGoal) {
			return {
				type: 'goal',
				title: linkedGoal.title,
				progress: linkedGoal.progress || 0
			};
		}
		return { type: 'category', categoryId: task.categoryId };
	});

	let recentSessions = $derived($focusSessions.slice().reverse().slice(0, 10));

	// Timer controls
	function startTimer() {
		if (timerPaused) {
			timerPaused = false;
			timerRunning = true;
		} else {
			timerSecondsRemaining = (sessionDuration || 25) * 60;
			timerRunning = true;
			timerPaused = false;
			sessionStartTime = new Date();
		}

		timerInterval = setInterval(() => {
			timerSecondsRemaining--;
			if (timerSecondsRemaining <= 0) {
				clearInterval(timerInterval);
				timerInterval = null;
				timerRunning = false;
				openPostSession();
			}
		}, 1000);
	}

	function pauseTimer() {
		if (!timerRunning) return;
		clearInterval(timerInterval);
		timerInterval = null;
		timerPaused = true;
		timerRunning = false;
	}

	function stopTimer() {
		clearInterval(timerInterval);
		timerInterval = null;

		if (timerRunning || timerPaused) {
			openPostSession();
		}
		timerRunning = false;
		timerPaused = false;
	}

	function resetTimerUI() {
		timerRunning = false;
		timerPaused = false;
		timerSecondsRemaining = (sessionDuration || 25) * 60;
	}

	function openPostSession() {
		const totalDuration = sessionDuration || 25;
		const elapsed = totalDuration - Math.ceil(timerSecondsRemaining / 60);
		sessionElapsed = elapsed < 1 ? totalDuration : elapsed;
		psDifficulty = 3;
		psDistractions = 0;
		psNotes = '';
		showPostSession = true;
	}

	function skipPostSession() {
		showPostSession = false;
		resetTimerUI();
	}

	async function saveSession() {
		let categoryId = selectedCategoryId;

		if (selectedTaskId) {
			const task = $tasks.find((t) => t.id === selectedTaskId);
			if (task) categoryId = task.categoryId;
		}

		const session = {
			id: generateId(),
			taskId: selectedTaskId || null,
			categoryId,
			startTime: sessionStartTime ? sessionStartTime.toISOString() : new Date().toISOString(),
			endTime: new Date().toISOString(),
			duration: sessionElapsed,
			difficultyRating: psDifficulty,
			distractionCount: psDistractions,
			notes: psNotes.trim()
		};

		$focusSessions = [...$focusSessions, session];
		await saveStore('focusSessions', $focusSessions);

		const result = awardXP(xp, 100, 'Focus session');
		await saveStore('xp', $xp);

		if (result.leveledUp) {
			showToast('Level up! You are now ' + result.newLevel + '!', 'success');
		}

		showPostSession = false;
		resetTimerUI();
		showToast('Session logged! +100 XP', 'success');
	}

	function onDurationChange() {
		if (!timerRunning && !timerPaused) {
			timerSecondsRemaining = (sessionDuration || 25) * 60;
		}
	}
</script>

<div class="page-header">
	<h1 class="page-title">Focus Mode</h1>
	<p class="page-subtitle">Deep work, one session at a time</p>
</div>

<div class="grid-dashboard">
	<!-- Timer Card -->
	<div class="card span-full" style="text-align:center;">
		<!-- Task Selector -->
		<div class="flex justify-center gap-2 mb-3" style="flex-wrap:wrap">
			<select
				bind:value={selectedTaskId}
				disabled={timerRunning || timerPaused}
				style="max-width:300px"
			>
				<option value="">Freeform Focus</option>
				{#each incompleteTasks as t}
					<option value={t.id}>{t.title}</option>
				{/each}
			</select>
			<select
				bind:value={selectedCategoryId}
				disabled={timerRunning || timerPaused}
				style="max-width:200px"
			>
				{#each $categories as cat}
					<option value={cat.id}>{cat.icon} {cat.name}</option>
				{/each}
			</select>
		</div>

		<!-- Why This Matters -->
		<div class="text-secondary text-sm mb-3" style="min-height:24px;">
			{#if whyMatters?.type === 'goal'}
				This contributes to: <strong class="text-accent">{whyMatters.title}</strong>
				({whyMatters.progress}% complete)
			{:else if whyMatters?.type === 'category'}
				Category: <CategoryBadge categoryId={whyMatters.categoryId} />
			{/if}
		</div>

		<!-- Big Timer -->
		<div
			style="font-size:5rem;font-weight:900;font-variant-numeric:tabular-nums;line-height:1;margin:var(--space-lg) 0;color:{timerColor};"
		>
			{timerDisplay}
		</div>

		<!-- Controls -->
		<div class="flex justify-center gap-2 mb-3">
			<button
				class="btn btn-primary btn-lg"
				onclick={startTimer}
				disabled={timerRunning}
			>
				{timerPaused ? 'Resume' : 'Start'}
			</button>
			<button
				class="btn btn-lg"
				onclick={pauseTimer}
				disabled={!timerRunning}
			>
				Pause
			</button>
			<button
				class="btn btn-danger btn-lg"
				onclick={stopTimer}
				disabled={!timerRunning && !timerPaused}
			>
				Stop
			</button>
		</div>

		<!-- Session Duration Setting -->
		<div class="flex justify-center gap-2 items-center text-sm text-secondary">
			<span>Duration:</span>
			<input
				type="number"
				bind:value={sessionDuration}
				oninput={onDurationChange}
				min="1"
				max="120"
				disabled={timerRunning || timerPaused}
				style="width:70px;text-align:center;"
			/>
			<span>min</span>
		</div>
	</div>

	<!-- Recent Sessions -->
	<div class="card span-full">
		<div class="card-header">
			<h2 class="card-title">Recent Sessions</h2>
			<span class="badge">{$focusSessions.length} sessions</span>
		</div>
		<div class="card-body">
			{#if $focusSessions.length === 0}
				<div class="empty-state">
					<div class="empty-state-icon">&#128293;</div>
					<div class="empty-state-title">No sessions yet</div>
					<div class="empty-state-text">Start a focus session to log your work</div>
				</div>
			{:else}
				<div style="overflow-x:auto">
					<table style="width:100%;border-collapse:collapse">
						<thead>
							<tr style="border-bottom:1px solid var(--border-color)">
								<th class="text-sm text-left" style="padding:var(--space-sm)">Date</th>
								<th class="text-sm text-left" style="padding:var(--space-sm)">Category</th>
								<th class="text-sm text-left" style="padding:var(--space-sm)">Duration</th>
								<th class="text-sm text-left" style="padding:var(--space-sm)">Difficulty</th>
								<th class="text-sm text-left" style="padding:var(--space-sm)">Distractions</th>
								<th class="text-sm text-left" style="padding:var(--space-sm)">Notes</th>
							</tr>
						</thead>
						<tbody>
							{#each recentSessions as s}
								<tr style="border-bottom:1px solid var(--border-subtle)">
									<td class="text-sm" style="padding:var(--space-sm)">{timeAgo(s.startTime)}</td>
									<td style="padding:var(--space-sm)">
										<CategoryBadge categoryId={s.categoryId} />
									</td>
									<td class="text-sm" style="padding:var(--space-sm)">{s.duration || 0}m</td>
									<td style="padding:var(--space-sm)">
										<StarRating rating={s.difficultyRating || 0} />
									</td>
									<td class="text-sm text-center" style="padding:var(--space-sm)">{s.distractionCount || 0}</td>
									<td
										class="text-sm text-muted"
										style="padding:var(--space-sm);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
									>
										{s.notes || ''}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Post-Session Modal -->
{#if showPostSession}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay visible" onclick={(e) => { if (e.target === e.currentTarget) skipPostSession(); }}>
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2 class="modal-title">Session Complete!</h2>
				<button class="modal-close" onclick={skipPostSession} aria-label="Close">&times;</button>
			</div>
			<div class="modal-body">
				<div class="text-center mb-3">
					<div class="stat-number success" style="font-size:var(--font-size-2xl)">{sessionElapsed} min</div>
					<div class="text-sm text-secondary">Session Duration</div>
				</div>
				<div class="form-group">
					<label class="form-label">Difficulty Rating (1-5)</label>
					<select bind:value={psDifficulty}>
						<option value={1}>1 - Easy</option>
						<option value={2}>2 - Moderate</option>
						<option value={3}>3 - Normal</option>
						<option value={4}>4 - Hard</option>
						<option value={5}>5 - Very Hard</option>
					</select>
				</div>
				<div class="form-group">
					<label class="form-label">Distraction Count</label>
					<input type="number" bind:value={psDistractions} min="0" />
				</div>
				<div class="form-group">
					<label class="form-label">Notes</label>
					<textarea bind:value={psNotes} rows="3" placeholder="What did you work on?"></textarea>
				</div>
				<div class="flex gap-1" style="justify-content:flex-end">
					<button class="btn" onclick={skipPostSession}>Skip</button>
					<button class="btn btn-primary" onclick={saveSession}>Save Session</button>
				</div>
			</div>
		</div>
	</div>
{/if}
