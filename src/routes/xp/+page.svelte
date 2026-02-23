<script>
	import { xp, tasks, focusSessions, moodEntries, notes, saveStore } from '$lib/stores/data.js';
	import { getLevelInfo, LEVEL_THRESHOLDS } from '$lib/helpers.js';

	const LEVELS = [
		{ xp: 0,     name: 'Beginner',    icon: '\u{1F469}\u200D\u{1F4BB}' },
		{ xp: 500,   name: 'Novice',      icon: '\u{1F913}' },
		{ xp: 1500,  name: 'Apprentice',  icon: '\u2694\uFE0F' },
		{ xp: 3000,  name: 'Journeyman',  icon: '\u{1F4AA}' },
		{ xp: 5000,  name: 'Expert',      icon: '\u{1F31F}' },
		{ xp: 8000,  name: 'Master',      icon: '\u{1F451}' },
		{ xp: 12000, name: 'Legend',       icon: '\u{1F3C6}' }
	];

	const ACHIEVEMENTS = [
		{ id: 'first_focus',     name: 'First Focus',     desc: 'Complete 1 focus session',        icon: '\u{1F525}' },
		{ id: 'task_master_10',  name: 'Task Master',      desc: 'Complete 10 tasks',               icon: '\u2705' },
		{ id: 'week_warrior',    name: 'Week Warrior',     desc: '7-day check-in streak',           icon: '\u{1F4AA}' },
		{ id: 'deep_worker',     name: 'Deep Worker',      desc: 'Complete 10 focus sessions',      icon: '\u{1F9E0}' },
		{ id: 'centurion',       name: 'Centurion',        desc: 'Complete 100 tasks',              icon: '\u{1F3C6}' },
		{ id: 'note_taker',      name: 'Note Taker',       desc: 'Create 5 notes',                  icon: '\u{1F4DD}' },
		{ id: 'xp_500',          name: 'Getting Started',  desc: 'Earn 500 XP total',               icon: '\u2B50' },
		{ id: 'xp_5000',         name: 'High Achiever',    desc: 'Earn 5000 XP total',              icon: '\u{1F31F}' }
	];

	function getCurrentLevel(totalXp) {
		let level = LEVELS[0];
		let next = LEVELS[1] || null;
		for (let i = LEVELS.length - 1; i >= 0; i--) {
			if (totalXp >= LEVELS[i].xp) {
				level = LEVELS[i];
				next = LEVELS[i + 1] || null;
				break;
			}
		}
		return { current: level, next };
	}

	function getWeekStart(date) {
		const d = new Date(date);
		d.setDate(d.getDate() - d.getDay());
		d.setHours(0, 0, 0, 0);
		return d;
	}

	function getCheckinStreak() {
		if ($moodEntries.length === 0) return 0;
		const sorted = [...$moodEntries].sort((a, b) => new Date(b.date) - new Date(a.date));
		let streak = 0;
		const check = new Date();
		check.setHours(0, 0, 0, 0);

		for (let i = 0; i < 365; i++) {
			const dateStr = check.toISOString().split('T')[0];
			const found = sorted.some(m => m.date && m.date.indexOf(dateStr) === 0);
			if (found) { streak++; check.setDate(check.getDate() - 1); }
			else break;
		}
		return streak;
	}

	function getWeeklyXp(weekOffset) {
		const now = new Date();
		const weekStart = getWeekStart(now);
		weekStart.setDate(weekStart.getDate() + (weekOffset * 7));
		const weekEnd = new Date(weekStart);
		weekEnd.setDate(weekEnd.getDate() + 7);

		let xpVal = 0;
		xpVal += $focusSessions.filter(s => {
			const d = new Date(s.startTime || s.endTime);
			return d >= weekStart && d < weekEnd;
		}).length * 100;

		xpVal += $tasks.filter(t => {
			if (!t.completed || !t.completedAt) return false;
			const d = new Date(t.completedAt);
			return d >= weekStart && d < weekEnd;
		}).length * 50;

		xpVal += $moodEntries.filter(m => {
			const d = new Date(m.date);
			return d >= weekStart && d < weekEnd;
		}).length * 25;

		return xpVal;
	}

	// Check & award achievements
	function checkAchievements() {
		const completedTasks = $tasks.filter(t => t.completed).length;
		const streak = getCheckinStreak();
		const totalXp = $xp.totalXp || 0;
		const noteCount = $notes.length;

		const checks = {
			first_focus: $focusSessions.length >= 1,
			task_master_10: completedTasks >= 10,
			week_warrior: streak >= 7,
			deep_worker: $focusSessions.length >= 10,
			centurion: completedTasks >= 100,
			note_taker: noteCount >= 5,
			xp_500: totalXp >= 500,
			xp_5000: totalXp >= 5000
		};

		const existing = $xp.achievements || [];
		let changed = false;
		for (const [id, passed] of Object.entries(checks)) {
			if (passed && !existing.includes(id)) {
				existing.push(id);
				changed = true;
			}
		}
		if (changed) {
			$xp.achievements = existing;
			$xp = $xp;
			saveStore('xp', $xp);
		}
	}

	// Run achievements check reactively
	$effect(() => {
		// Access reactive dependencies
		void $focusSessions.length;
		void $tasks.length;
		void $moodEntries.length;
		void $notes.length;
		void $xp.totalXp;
		checkAchievements();
	});

	// --- Derived display data ---
	let totalXp = $derived($xp.totalXp || 0);
	let levelInfo = $derived(getCurrentLevel(totalXp));
	let currentLevel = $derived(levelInfo.current);
	let nextLevel = $derived(levelInfo.next);

	let levelIdx = $derived(LEVELS.findIndex(l => l.name === currentLevel.name));

	let progressPct = $derived.by(() => {
		if (!nextLevel) return 100;
		const range = nextLevel.xp - currentLevel.xp;
		const progress = totalXp - currentLevel.xp;
		return range > 0 ? Math.min(100, Math.round((progress / range) * 100)) : 100;
	});

	let progressText = $derived(nextLevel ? `${totalXp} / ${nextLevel.xp} XP` : 'MAX LEVEL');

	let thisWeekXp = $derived(getWeeklyXp(0));
	let lastWeekXp = $derived(getWeeklyXp(-1));
	let diff = $derived(thisWeekXp - lastWeekXp);
	let unlockedCount = $derived(($xp.achievements || []).length);
	let maxWeekXp = $derived(Math.max(thisWeekXp, lastWeekXp, 1));
</script>

<svelte:head>
	<style>
		.level-display {
			text-align: center;
			padding: var(--space-2xl) var(--space-lg);
		}
		.level-icon { font-size: 4rem; margin-bottom: var(--space-md); }
		.level-name {
			font-size: var(--font-size-2xl);
			font-weight: 800;
			background: linear-gradient(135deg, var(--accent), #a78bfa);
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
			background-clip: text;
		}
		.level-xp { font-size: var(--font-size-lg); color: var(--text-secondary); margin-top: var(--space-sm); }
		.xp-bar-wrapper { margin-top: var(--space-lg); max-width: 400px; margin-left: auto; margin-right: auto; }
		.achievement-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: var(--space-md); }
		.achievement-card {
			text-align: center;
			padding: var(--space-lg);
			border-radius: var(--border-radius-lg);
			background: var(--bg-primary);
			border: 1px solid var(--border-subtle);
			transition: all var(--transition-fast);
		}
		.achievement-card.unlocked {
			border-color: var(--accent);
			box-shadow: 0 0 12px var(--accent-glow);
		}
		.achievement-card.locked { opacity: 0.4; }
		.achievement-icon { font-size: 2.5rem; margin-bottom: var(--space-sm); }
		.achievement-name { font-weight: 700; font-size: var(--font-size-md); }
		.achievement-desc { font-size: var(--font-size-xs); color: var(--text-muted); margin-top: var(--space-xs); }
		.rates-table { width: 100%; border-collapse: collapse; }
		.rates-table th, .rates-table td {
			padding: var(--space-sm) var(--space-md);
			text-align: left;
			border-bottom: 1px solid var(--border-subtle);
			font-size: var(--font-size-sm);
		}
		.rates-table th { color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-size: var(--font-size-xs); }
		.rates-table td:last-child { text-align: right; color: var(--accent); font-weight: 700; }
	</style>
</svelte:head>

<div class="page-header">
	<h1 class="page-title">XP & Competitive</h1>
	<p class="page-subtitle">Track your growth and earn achievements</p>
</div>

<!-- Level Display -->
<div class="card mb-3">
	<div class="level-display">
		<div class="level-icon">{currentLevel.icon}</div>
		<div class="level-name">Level {levelIdx + 1} &mdash; {currentLevel.name}</div>
		<div class="level-xp">{totalXp.toLocaleString()} XP</div>
		<div class="xp-bar-wrapper">
			<div class="progress-label">
				<span class="progress-label-name">{nextLevel ? `Next: ${nextLevel.name}` : 'Max Level'}</span>
				<span class="progress-label-value">{progressText}</span>
			</div>
			<div class="progress-bar">
				<div class="progress-bar-fill" style="width:{progressPct}%"></div>
			</div>
		</div>
	</div>
</div>

<!-- Stats Row -->
<div class="grid-stats mb-3">
	<div class="card stat-card">
		<div class="stat-number accent">{totalXp.toLocaleString()}</div>
		<div class="stat-label">Total XP</div>
	</div>
	<div class="card stat-card">
		<div class="stat-number">{thisWeekXp}</div>
		<div class="stat-label">This Week</div>
	</div>
	<div class="card stat-card">
		<div class="stat-number {diff >= 0 ? 'success' : 'danger'}">{diff >= 0 ? '+' : ''}{diff}</div>
		<div class="stat-label">vs Last Week</div>
	</div>
	<div class="card stat-card">
		<div class="stat-number">{unlockedCount}/{ACHIEVEMENTS.length}</div>
		<div class="stat-label">Achievements</div>
	</div>
</div>

<div class="grid-2 mb-3">
	<!-- XP Earning Rates -->
	<div class="card">
		<div class="card-header">
			<h2 class="card-title">XP Earning Rates</h2>
		</div>
		<table class="rates-table">
			<thead><tr><th>Action</th><th>XP</th></tr></thead>
			<tbody>
				<tr><td>Complete a focus session</td><td>+100</td></tr>
				<tr><td>Complete a task</td><td>+50</td></tr>
				<tr><td>Daily check-in</td><td>+25</td></tr>
				<tr><td>Add a goal</td><td>+25</td></tr>
				<tr><td>Add a note</td><td>+10</td></tr>
			</tbody>
		</table>
	</div>

	<!-- Weekly Comparison -->
	<div class="card">
		<div class="card-header">
			<h2 class="card-title">Weekly Comparison</h2>
		</div>
		<div class="card-body">
			<div style="margin-bottom:var(--space-md)">
				<div class="flex-between mb-1">
					<span class="text-sm font-bold">This Week</span>
					<span class="text-sm text-accent">{thisWeekXp} XP</span>
				</div>
				<div class="progress-bar">
					<div class="progress-bar-fill" style="width:{(thisWeekXp / maxWeekXp) * 100}%"></div>
				</div>
			</div>
			<div>
				<div class="flex-between mb-1">
					<span class="text-sm font-bold">Last Week</span>
					<span class="text-sm text-secondary">{lastWeekXp} XP</span>
				</div>
				<div class="progress-bar">
					<div class="progress-bar-fill" style="width:{(lastWeekXp / maxWeekXp) * 100}%;opacity:0.5"></div>
				</div>
			</div>
			{#if diff > 0}
				<p class="text-sm text-success mt-2">Up {diff} XP from last week!</p>
			{:else if diff < 0}
				<p class="text-sm text-danger mt-2">Down {Math.abs(diff)} XP from last week.</p>
			{:else}
				<p class="text-sm text-muted mt-2">Same as last week.</p>
			{/if}
		</div>
	</div>
</div>

<!-- Achievements -->
<div class="card">
	<div class="card-header">
		<h2 class="card-title">Achievements</h2>
		<span class="text-sm text-muted">{unlockedCount} / {ACHIEVEMENTS.length} unlocked</span>
	</div>
	<div class="achievement-grid" style="padding:var(--space-md)">
		{#each ACHIEVEMENTS as a}
			{@const unlocked = ($xp.achievements || []).includes(a.id)}
			<div class="achievement-card {unlocked ? 'unlocked' : 'locked'}">
				<div class="achievement-icon">{a.icon}</div>
				<div class="achievement-name">{a.name}</div>
				<div class="achievement-desc">{a.desc}</div>
				{#if unlocked}
					<div class="badge badge-success mt-1" style="display:inline-flex">Unlocked</div>
				{:else}
					<div class="badge badge-muted mt-1" style="display:inline-flex">Locked</div>
				{/if}
			</div>
		{/each}
	</div>
</div>
