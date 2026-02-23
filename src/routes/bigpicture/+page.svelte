<script>
	import { categories, focusSessions } from '$lib/stores/data.js';
	import { getCategoryColor } from '$lib/helpers.js';

	function getWeekStart(date) {
		const d = new Date(date);
		d.setDate(d.getDate() - d.getDay());
		d.setHours(0, 0, 0, 0);
		return d;
	}

	function getSessionsForWeek(weekStart) {
		const weekEnd = new Date(weekStart);
		weekEnd.setDate(weekEnd.getDate() + 7);
		return $focusSessions.filter(s => {
			const d = new Date(s.startTime || s.endTime);
			return d >= weekStart && d < weekEnd;
		});
	}

	function getHoursByCategory(sessions) {
		const map = {};
		for (const s of sessions) {
			const catId = s.categoryId || 'unknown';
			map[catId] = (map[catId] || 0) + (s.duration || 0) / 60;
		}
		return map;
	}

	function getTotalHours(hourMap) {
		return Object.values(hourMap).reduce((sum, h) => sum + h, 0);
	}

	// --- Core computed data ---
	let thisWeekStart = $derived(getWeekStart(new Date()));
	let lastWeekStart = $derived.by(() => {
		const d = new Date(thisWeekStart);
		d.setDate(d.getDate() - 7);
		return d;
	});

	let thisWeekHours = $derived(getHoursByCategory(getSessionsForWeek(thisWeekStart)));
	let lastWeekHours = $derived(getHoursByCategory(getSessionsForWeek(lastWeekStart)));

	let thisTotal = $derived(getTotalHours(thisWeekHours));
	let lastTotal = $derived(getTotalHours(lastWeekHours));
	let totalDiff = $derived(thisTotal - lastTotal);

	// --- Bar scaling ---
	let maxHours = $derived.by(() => {
		let max = 1;
		for (const cat of $categories) {
			const actual = thisWeekHours[cat.id] || 0;
			const target = cat.weeklyHoursTarget || 0;
			if (actual > max) max = actual;
			if (target > max) max = target;
		}
		return max;
	});

	// --- Gap analysis + bars data ---
	let categoryData = $derived.by(() => {
		return $categories.map(c => {
			const actualHrs = thisWeekHours[c.id] || 0;
			const targetHrs = c.weeklyHoursTarget || 0;
			const actualPct = maxHours > 0 ? (actualHrs / maxHours) * 100 : 0;
			const targetPct = maxHours > 0 ? (targetHrs / maxHours) * 100 : 0;
			const color = getCategoryColor($categories, c.id) || 'var(--accent)';
			const gap = actualHrs - targetHrs;
			const gapAbs = Math.abs(gap).toFixed(1);

			let gapColor, gapLabel;
			if (Math.abs(gap) < 0.5) {
				gapColor = 'var(--success)';
				gapLabel = 'On target';
			} else if (gap > 0) {
				gapColor = 'var(--info)';
				gapLabel = `+${gapAbs}h surplus`;
			} else {
				gapColor = 'var(--danger)';
				gapLabel = `-${gapAbs}h deficit`;
			}

			return { cat: c, actualHrs, targetHrs, actualPct, targetPct, color, gap, gapAbs, gapColor, gapLabel };
		});
	});

	// --- Insights ---
	let insights = $derived.by(() => {
		const items = [];

		if (totalDiff > 0) {
			items.push(`Total productive hours are <strong>up ${totalDiff.toFixed(1)}h</strong> compared to last week.`);
		} else if (totalDiff < 0) {
			items.push(`Total productive hours are <strong>down ${Math.abs(totalDiff).toFixed(1)}h</strong> compared to last week.`);
		}

		for (const d of categoryData) {
			if (d.gap > 1.5) {
				items.push(`You're spending <strong>${d.gapAbs} extra hours</strong> on ${d.cat.name} this week.`);
			} else if (d.gap < -1.5) {
				items.push(`${d.cat.name} is <strong>${d.gapAbs} hours below</strong> your target.`);
			}
		}

		if (items.length === 0) {
			items.push('Start logging focus sessions to get personalized insights about your time allocation.');
		}

		return items;
	});
</script>

<div class="page-header">
	<h1 class="page-title">Big Picture</h1>
	<p class="page-subtitle">Where your time goes vs where you want it</p>
</div>

<!-- Stats Row -->
<div class="grid-stats mb-3">
	<div class="card stat-card">
		<div class="stat-number accent">{thisTotal.toFixed(1)}h</div>
		<div class="stat-label">This Week</div>
	</div>
	<div class="card stat-card">
		<div class="stat-number">{lastTotal.toFixed(1)}h</div>
		<div class="stat-label">Last Week</div>
	</div>
	<div class="card stat-card">
		<div class="stat-number {totalDiff >= 0 ? 'success' : 'danger'}">{totalDiff >= 0 ? '+' : ''}{totalDiff.toFixed(1)}h</div>
		<div class="stat-label">Difference</div>
	</div>
	<div class="card stat-card">
		<div class="stat-number">{$categories.length}</div>
		<div class="stat-label">Categories</div>
	</div>
</div>

<!-- Key Insights -->
<div class="card mb-3">
	<div class="card-header">
		<h2 class="card-title">Key Insights</h2>
	</div>
	<div class="card-body">
		{#each insights as text}
			<p style="padding:var(--space-sm) 0;border-bottom:1px solid var(--border-subtle);color:var(--text-secondary);font-size:var(--font-size-sm)">{@html '💡 ' + text}</p>
		{/each}
	</div>
</div>

<!-- Time Allocation Comparison -->
<div class="card mb-3">
	<div class="card-header">
		<h2 class="card-title">Time Allocation Comparison</h2>
		<div class="flex gap-2">
			<span class="badge badge-info">Actual</span>
			<span class="badge badge-muted">Target</span>
		</div>
	</div>
	<div class="card-body">
		{#each categoryData as d}
			<div style="margin-bottom:var(--space-lg)">
				<div class="flex-between mb-1">
					<span class="font-bold">{d.cat.icon} {d.cat.name}</span>
					<span class="text-sm text-muted">{d.actualHrs.toFixed(1)}h / {d.targetHrs}h target</span>
				</div>
				<div style="display:flex;gap:var(--space-sm);align-items:center">
					<span class="text-xs text-muted" style="width:50px">Actual</span>
					<div style="flex:1;height:14px;background:var(--bg-primary);border-radius:7px;overflow:hidden">
						<div style="width:{d.actualPct}%;height:100%;background:{d.color};border-radius:7px;transition:width 0.4s"></div>
					</div>
				</div>
				<div style="display:flex;gap:var(--space-sm);align-items:center;margin-top:4px">
					<span class="text-xs text-muted" style="width:50px">Target</span>
					<div style="flex:1;height:14px;background:var(--bg-primary);border-radius:7px;overflow:hidden">
						<div style="width:{d.targetPct}%;height:100%;background:var(--text-muted);opacity:0.4;border-radius:7px;transition:width 0.4s"></div>
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>

<!-- Gap Analysis -->
<div class="card">
	<div class="card-header">
		<h2 class="card-title">Gap Analysis</h2>
	</div>
	<div class="card-body">
		{#if categoryData.length === 0}
			<p class="text-muted text-sm">Add categories with hour targets in Settings to see gap analysis.</p>
		{:else}
			{#each categoryData as d}
				<div class="flex-between" style="padding:var(--space-sm) 0;border-bottom:1px solid var(--border-subtle)">
					<span>{d.cat.icon} {d.cat.name}</span>
					<span style="color:{d.gapColor};font-weight:700">{d.gapLabel}</span>
				</div>
			{/each}
		{/if}
	</div>
</div>
