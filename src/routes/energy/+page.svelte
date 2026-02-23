<script>
	import { moodEntries, xp, saveStore } from '$lib/stores/data.js';
	import { generateId, awardXP } from '$lib/helpers.js';
	import { showToast } from '$lib/stores/toast.js';

	// Helpers
	function todayStr() {
		return new Date().toISOString().slice(0, 10);
	}

	let todayEntry = $derived($moodEntries.find((e) => e.date === todayStr()) || null);

	let sorted = $derived(
		$moodEntries.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
	);
	let last7 = $derived(sorted.slice(-7));
	let last14 = $derived(sorted.slice(-14));

	// Streak
	let streak = $derived.by(() => {
		const desc = $moodEntries
			.slice()
			.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
		if (desc.length === 0) return 0;
		let count = 0;
		const d = new Date();
		for (let i = 0; i < desc.length; i++) {
			const expected = new Date(d);
			expected.setDate(expected.getDate() - i);
			const expStr = expected.toISOString().slice(0, 10);
			if (desc[i].date === expStr) count++;
			else break;
		}
		return count;
	});

	// Averages
	let avgEnergy = $derived(
		last7.length > 0
			? (last7.reduce((s, e) => s + (e.energy || 0), 0) / last7.length).toFixed(1)
			: '0'
	);
	let avgStress = $derived(
		last7.length > 0
			? (last7.reduce((s, e) => s + (e.stress || 0), 0) / last7.length).toFixed(1)
			: '0'
	);
	let avgSleep = $derived(
		last7.length > 0
			? (last7.reduce((s, e) => s + (e.sleep || 0), 0) / last7.length).toFixed(1)
			: '0'
	);

	// Form state
	let energy = $state(5);
	let stress = $state(5);
	let sleep = $state(7);
	let workout = $state(false);
	let notes = $state('');

	// Sync form when todayEntry changes
	$effect(() => {
		if (todayEntry) {
			energy = todayEntry.energy;
			stress = todayEntry.stress;
			sleep = todayEntry.sleep;
			workout = todayEntry.workout;
			notes = todayEntry.notes || '';
		}
	});

	// Insights
	let insights = $derived.by(() => {
		const entries = last14;
		if (entries.length < 3) return ['Need at least 3 check-ins for insights.'];

		const result = [];

		// Workout vs energy
		const workoutDays = entries.filter((e) => e.workout);
		const restDays = entries.filter((e) => !e.workout);
		if (workoutDays.length > 0 && restDays.length > 0) {
			const avgEW = workoutDays.reduce((s, e) => s + e.energy, 0) / workoutDays.length;
			const avgER = restDays.reduce((s, e) => s + e.energy, 0) / restDays.length;
			if (avgEW > avgER + 0.5) {
				result.push(
					`Your energy is <strong>${(avgEW - avgER).toFixed(1)} points higher</strong> on workout days.`
				);
			} else if (avgER > avgEW + 0.5) {
				result.push(
					'Your energy is slightly higher on rest days. You might be overtraining.'
				);
			}
		}

		// Sleep vs energy
		const goodSleep = entries.filter((e) => e.sleep >= 7);
		const badSleep = entries.filter((e) => e.sleep < 7);
		if (goodSleep.length > 0 && badSleep.length > 0) {
			const avgGS = goodSleep.reduce((s, e) => s + e.energy, 0) / goodSleep.length;
			const avgBS = badSleep.reduce((s, e) => s + e.energy, 0) / badSleep.length;
			if (avgGS > avgBS + 0.5) {
				result.push(
					`You have <strong>${(avgGS - avgBS).toFixed(1)} more energy</strong> when sleeping 7+ hours.`
				);
			}
		}

		// Stress trend
		if (entries.length >= 7) {
			const recent3 = entries.slice(-3);
			const older3 = entries.slice(-7, -4);
			if (older3.length > 0) {
				const avgRecent = recent3.reduce((s, e) => s + e.stress, 0) / recent3.length;
				const avgOlder = older3.reduce((s, e) => s + e.stress, 0) / older3.length;
				if (avgRecent > avgOlder + 1) {
					result.push(
						'Your stress has been <strong>rising</strong> over the last few days. Consider scheduling a break.'
					);
				} else if (avgRecent < avgOlder - 1) {
					result.push(
						'Your stress is <strong>trending down</strong>. Keep up the good habits!'
					);
				}
			}
		}

		if (result.length === 0) {
			result.push('Keep checking in! More data will unlock better insights.');
		}
		return result;
	});

	async function saveCheckin() {
		const today = todayStr();
		const isUpdate = !!todayEntry;

		if (isUpdate) {
			$moodEntries = $moodEntries.map((e) =>
				e.date === today
					? { ...e, energy, stress, sleep, workout, notes: notes.trim() }
					: e
			);
		} else {
			$moodEntries = [
				...$moodEntries,
				{
					id: generateId(),
					date: today,
					energy,
					stress,
					sleep,
					workout,
					notes: notes.trim()
				}
			];
			const result = awardXP(xp, 25, 'Daily check-in');
			await saveStore('xp', $xp);
			if (result.leveledUp) {
				showToast('Level up! You are now ' + result.newLevel + '!', 'success');
			}
		}

		await saveStore('moodEntries', $moodEntries);
		showToast(isUpdate ? 'Check-in updated' : 'Check-in saved! +25 XP', 'success');
	}
</script>

<div class="page-header">
	<h1 class="page-title">Energy & Mood</h1>
	<p class="page-subtitle">Track your daily energy, stress, and sleep patterns</p>
</div>

<!-- Stats Row -->
<div class="grid-stats mb-3">
	<div class="card stat-card">
		<div class="stat-number accent">{streak}</div>
		<div class="stat-label">Day Streak</div>
	</div>
	<div class="card stat-card">
		<div class="stat-number success">{avgEnergy}</div>
		<div class="stat-label">Avg Energy (7d)</div>
	</div>
	<div class="card stat-card">
		<div class="stat-number warning">{avgStress}</div>
		<div class="stat-label">Avg Stress (7d)</div>
	</div>
	<div class="card stat-card">
		<div class="stat-number">{avgSleep}h</div>
		<div class="stat-label">Avg Sleep (7d)</div>
	</div>
</div>

<!-- Check-in Form -->
<div class="card mb-3">
	<div class="card-header">
		<h2 class="card-title">Daily Check-in</h2>
		{#if todayEntry}
			<span class="badge badge-success">Completed today</span>
		{:else}
			<span class="badge badge-warning">Not yet</span>
		{/if}
	</div>
	<div class="card-body">
		<div class="grid-2">
			<div class="form-group">
				<label class="form-label">Energy Level: <span>{energy}</span>/10</label>
				<input
					type="range"
					min="1"
					max="10"
					bind:value={energy}
					style="width:100%;accent-color:var(--success)"
				/>
			</div>
			<div class="form-group">
				<label class="form-label">Stress Level: <span>{stress}</span>/10</label>
				<input
					type="range"
					min="1"
					max="10"
					bind:value={stress}
					style="width:100%;accent-color:var(--warning)"
				/>
			</div>
		</div>
		<div class="grid-2">
			<div class="form-group">
				<label class="form-label">Sleep Hours</label>
				<input type="number" bind:value={sleep} min="0" max="24" step="0.5" />
			</div>
			<div class="form-group">
				<label class="form-label">Workout Today?</label>
				<label class="toggle" style="margin-top:6px">
					<input type="checkbox" bind:checked={workout} />
					<span class="toggle-slider"></span>
				</label>
			</div>
		</div>
		<div class="form-group">
			<label class="form-label">Notes (optional)</label>
			<textarea bind:value={notes} rows="2" placeholder="How are you feeling?"></textarea>
		</div>
		<button class="btn btn-primary" onclick={saveCheckin}>
			{todayEntry ? 'Update Check-in' : 'Save Check-in'}
		</button>
	</div>
</div>

<!-- Charts Row -->
<div class="grid-2 mb-3">
	<div class="card">
		<div class="card-header">
			<h2 class="card-title">Energy (14 days)</h2>
		</div>
		<div class="card-body">
			{#if last14.length === 0}
				<p class="text-muted text-center">No data yet</p>
			{:else}
				<div style="display:flex;align-items:flex-end;gap:4px;height:140px">
					{#each last14 as entry}
						{@const pct = ((entry.energy || 0) / 10) * 100}
						<div
							style="flex:1;display:flex;flex-direction:column;align-items:center;height:100%"
						>
							<div style="flex:1;width:100%;display:flex;align-items:flex-end">
								<div
									style="width:100%;height:{pct}%;background:var(--success);border-radius:4px 4px 0 0;min-height:2px;transition:height 0.3s"
									title={String(entry.energy || 0)}
								></div>
							</div>
							<span class="text-xs text-muted" style="margin-top:4px;white-space:nowrap"
								>{entry.date.slice(5)}</span
							>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
	<div class="card">
		<div class="card-header">
			<h2 class="card-title">Stress (14 days)</h2>
		</div>
		<div class="card-body">
			{#if last14.length === 0}
				<p class="text-muted text-center">No data yet</p>
			{:else}
				<div style="display:flex;align-items:flex-end;gap:4px;height:140px">
					{#each last14 as entry}
						{@const pct = ((entry.stress || 0) / 10) * 100}
						<div
							style="flex:1;display:flex;flex-direction:column;align-items:center;height:100%"
						>
							<div style="flex:1;width:100%;display:flex;align-items:flex-end">
								<div
									style="width:100%;height:{pct}%;background:var(--warning);border-radius:4px 4px 0 0;min-height:2px;transition:height 0.3s"
									title={String(entry.stress || 0)}
								></div>
							</div>
							<span class="text-xs text-muted" style="margin-top:4px;white-space:nowrap"
								>{entry.date.slice(5)}</span
							>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Sleep Trend -->
<div class="card mb-3">
	<div class="card-header">
		<h2 class="card-title">Sleep Trend</h2>
	</div>
	<div class="card-body">
		{#if last14.length === 0}
			<p class="text-muted text-center">No data yet</p>
		{:else}
			<div style="display:flex;align-items:flex-end;gap:4px;height:120px">
				{#each last14 as entry}
					{@const val = entry.sleep || 0}
					{@const pct = Math.min((val / 12) * 100, 100)}
					{@const color = val < 6 ? 'var(--danger)' : val < 7 ? 'var(--warning)' : 'var(--accent)'}
					<div
						style="flex:1;display:flex;flex-direction:column;align-items:center;height:100%"
					>
						<span class="text-xs" style="color:var(--text-secondary);margin-bottom:2px"
							>{val}h</span
						>
						<div style="flex:1;width:100%;display:flex;align-items:flex-end">
							<div
								style="width:100%;height:{pct}%;background:{color};border-radius:4px 4px 0 0;min-height:2px"
							></div>
						</div>
						<span class="text-xs text-muted" style="margin-top:4px">{entry.date.slice(5)}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- Insights -->
<div class="card">
	<div class="card-header">
		<h2 class="card-title">Insights</h2>
	</div>
	<div class="card-body">
		{#each insights as insight}
			<div class="list-item">
				<span style="font-size:1.2rem;margin-right:8px">&#128161;</span>
				<span>{@html insight}</span>
			</div>
		{/each}
	</div>
</div>
