<script>
	import { tasks } from '$lib/stores/data.js';
	import { formatDate } from '$lib/helpers.js';
	import CategoryBadge from '$lib/components/CategoryBadge.svelte';
	import StarRating from '$lib/components/StarRating.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';

	// Risk calculation helpers
	function getCategoryCompletionRate(categoryId) {
		const catTasks = $tasks.filter((t) => t.categoryId === categoryId);
		if (catTasks.length === 0) return 0.5;
		return catTasks.filter((t) => t.completed).length / catTasks.length;
	}

	function getOverallCompletionRate() {
		if ($tasks.length === 0) return 0.5;
		return $tasks.filter((t) => t.completed).length / $tasks.length;
	}

	function calculateRisk(task) {
		// Factor 1: Difficulty (1-5) - higher = riskier -- weight 30%
		const difficultyScore = ((task.difficulty || 3) - 1) / 4;

		// Factor 2: Deadline distance -- further = riskier -- weight 25%
		let deadlineScore = 0.5;
		if (task.dueDate) {
			const daysUntil =
				(new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
			if (daysUntil <= 0) deadlineScore = 0.1;
			else if (daysUntil <= 1) deadlineScore = 0.15;
			else if (daysUntil <= 3) deadlineScore = 0.3;
			else if (daysUntil <= 7) deadlineScore = 0.5;
			else if (daysUntil <= 14) deadlineScore = 0.7;
			else deadlineScore = 0.9;
		}

		// Factor 3: Past completion patterns for category -- weight 25%
		const categoryScore = 1 - getCategoryCompletionRate(task.categoryId);

		// Factor 4: Overall completion rate -- weight 20%
		const overallScore = 1 - getOverallCompletionRate();

		return Math.round(
			(difficultyScore * 0.3 + deadlineScore * 0.25 + categoryScore * 0.25 + overallScore * 0.2) *
				100
		);
	}

	function getRiskColor(risk) {
		if (risk <= 33) return 'success';
		if (risk <= 66) return 'warning';
		return 'danger';
	}

	function getRiskLabel(risk) {
		if (risk <= 33) return 'Low';
		if (risk <= 66) return 'Medium';
		return 'High';
	}

	function getTips(task, risk) {
		const tips = [];
		if ((task.difficulty || 3) >= 4) {
			tips.push('Break into smaller chunks -- tackle the first part only');
		}
		if (task.dueDate) {
			const daysUntil =
				(new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
			if (daysUntil > 7) {
				tips.push('Start with just 5 minutes to build momentum');
			}
			if (daysUntil <= 1 && daysUntil > 0) {
				tips.push('Due very soon -- focus on this now');
			}
		}
		if (getCategoryCompletionRate(task.categoryId) < 0.5) {
			tips.push('This category has low completion -- try pairing it with a reward');
		}
		if (risk > 66) {
			tips.push('High risk -- schedule a specific time block for this task');
		}
		if (tips.length === 0) {
			tips.push("You're on track -- keep the momentum going!");
		}
		return tips;
	}

	// Derived data
	let upcoming = $derived($tasks.filter((t) => !t.completed));

	let risks = $derived.by(() => {
		return upcoming
			.map((t) => ({ task: t, risk: calculateRisk(t) }))
			.sort((a, b) => b.risk - a.risk);
	});

	let avgRisk = $derived(
		risks.length > 0
			? Math.round(risks.reduce((s, r) => s + r.risk, 0) / risks.length)
			: 0
	);

	let highCount = $derived(risks.filter((r) => r.risk > 66).length);
	let lowCount = $derived(risks.filter((r) => r.risk <= 33).length);
	let completionRate = $derived(Math.round(getOverallCompletionRate() * 100));

	let weeklyScoreColor = $derived(getRiskColor(avgRisk));
	let weeklyScoreLabel = $derived(getRiskLabel(avgRisk));
	let weeklyScoreText = $derived(
		avgRisk <= 33
			? 'Great discipline this week! Keep it up.'
			: avgRisk <= 66
				? 'Moderate risk -- watch out for the harder tasks.'
				: 'High procrastination risk -- consider breaking tasks into smaller pieces.'
	);
</script>

<div class="page-header">
	<h1 class="page-title">Procrastination Predictor</h1>
	<p class="page-subtitle">Know your risk before it strikes</p>
</div>

<!-- Stats Row -->
<div class="grid-stats mb-3">
	<div class="card stat-card">
		<div class="stat-number accent">{upcoming.length}</div>
		<div class="stat-label">Upcoming Tasks</div>
	</div>
	<div class="card stat-card">
		<div class="stat-number danger">{highCount}</div>
		<div class="stat-label">High Risk</div>
	</div>
	<div class="card stat-card">
		<div class="stat-number success">{lowCount}</div>
		<div class="stat-label">Low Risk</div>
	</div>
	<div class="card stat-card">
		<div class="stat-number {getRiskColor(avgRisk)}">{completionRate}%</div>
		<div class="stat-label">Completion Rate</div>
	</div>
</div>

<!-- Weekly Score Card -->
<div class="card mb-3">
	<div class="card-header">
		<h2 class="card-title">Weekly Procrastination Score</h2>
		<span class="badge badge-{weeklyScoreColor}">{avgRisk}% -- {weeklyScoreLabel}</span>
	</div>
	<div>
		<ProgressBar percent={avgRisk} color={weeklyScoreColor} />
	</div>
	<p class="text-sm text-secondary mt-2">{weeklyScoreText}</p>
</div>

<!-- Task List -->
<div class="card">
	<div class="card-header">
		<h2 class="card-title">Upcoming Tasks</h2>
		<span class="text-sm text-muted"
			>{upcoming.length} task{upcoming.length !== 1 ? 's' : ''}</span
		>
	</div>
	{#if risks.length === 0}
		<div class="empty-state">
			<div class="empty-state-icon">&#9203;</div>
			<div class="empty-state-title">No upcoming tasks</div>
			<div class="empty-state-text">
				Add tasks in the Academic Brain page to see procrastination predictions.
			</div>
		</div>
	{:else}
		{#each risks as item}
			{@const t = item.task}
			{@const risk = item.risk}
			{@const color = getRiskColor(risk)}
			{@const tips = getTips(t, risk)}
			{@const dueDateStr = t.dueDate ? formatDate(t.dueDate) : 'No deadline'}
			{@const daysUntil = t.dueDate
				? Math.ceil((new Date(t.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
				: null}
			<div class="list-item" style="align-items:flex-start;flex-wrap:wrap">
				<div style="flex:1;min-width:200px">
					<div class="flex items-center gap-1 mb-1">
						<strong>{t.title || 'Untitled'}</strong>
						<CategoryBadge categoryId={t.categoryId} />
						{#if daysUntil !== null && daysUntil < 0}
							<span class="badge badge-danger">Overdue</span>
						{:else if daysUntil !== null && daysUntil <= 1}
							<span class="badge badge-warning">Due today</span>
						{:else if daysUntil !== null && daysUntil <= 3}
							<span class="badge badge-warning">Due soon</span>
						{/if}
					</div>
					<div class="flex items-center gap-2 text-sm text-secondary">
						<span>{dueDateStr}</span>
						<span><StarRating rating={t.difficulty || 1} /></span>
						{#if t.estimatedMinutes}
							<span>{t.estimatedMinutes} min</span>
						{/if}
					</div>
					<div class="note-tags mt-1">
						{#each tips as tip}
							<span
								class="tag-pill"
								style="background:var(--{color}-bg,var(--bg-primary));color:var(--{color},var(--text-secondary))"
							>
								&#128161; {tip}
							</span>
						{/each}
					</div>
				</div>
				<div style="text-align:center;min-width:90px">
					<div class="stat-number {color}" style="font-size:var(--font-size-xl)">
						{risk}%
					</div>
					<div class="text-xs text-muted">{getRiskLabel(risk)} Risk</div>
					<div style="margin-top:var(--space-xs)">
						<ProgressBar percent={risk} {color} />
					</div>
				</div>
			</div>
		{/each}
	{/if}
</div>
