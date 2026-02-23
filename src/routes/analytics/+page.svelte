<script>
	import { categories, focusSessions, schedule } from '$lib/stores/data.js';
	import { getCategoryById, getCategoryColor } from '$lib/helpers.js';

	// --- Deep Work Stats ---
	let totalSessions = $derived($focusSessions.length);
	let totalMinutes = $derived($focusSessions.reduce((sum, s) => sum + (s.duration || 0), 0));
	let totalDistractions = $derived($focusSessions.reduce((sum, s) => sum + (s.distractionCount || 0), 0));
	let avgDuration = $derived(totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0);
	let avgDistractions = $derived(totalSessions > 0 ? (totalDistractions / totalSessions).toFixed(1) : '0');

	// --- Hours by Category ---
	let hoursByCategory = $derived.by(() => {
		const map = {};
		for (const s of $focusSessions) {
			const catId = s.categoryId || 'unknown';
			map[catId] = (map[catId] || 0) + (s.duration || 0) / 60;
		}
		return map;
	});

	let categoryBarData = $derived.by(() => {
		const catIds = Object.keys(hoursByCategory);
		if (catIds.length === 0) return [];
		const maxHours = Math.max(...catIds.map(id => hoursByCategory[id]));
		return catIds.map(catId => {
			const hours = hoursByCategory[catId];
			const cat = getCategoryById($categories, catId);
			const color = getCategoryColor($categories, catId) || 'var(--accent)';
			const name = cat ? `${cat.icon} ${cat.name}` : catId;
			const pct = maxHours > 0 ? (hours / maxHours) * 100 : 0;
			return { catId, hours, name, color, pct };
		});
	});

	// --- Planned vs Actual (this week) ---
	let actualThisWeek = $derived.by(() => {
		const now = new Date();
		const weekAgo = new Date(now);
		weekAgo.setDate(weekAgo.getDate() - 7);
		const map = {};
		for (const s of $focusSessions) {
			const sDate = new Date(s.startTime || s.endTime);
			if (sDate >= weekAgo && sDate <= now) {
				const catId = s.categoryId || 'unknown';
				map[catId] = (map[catId] || 0) + (s.duration || 0) / 60;
			}
		}
		return map;
	});

	let plannedVsActualData = $derived.by(() => {
		return $categories.map(cat => {
			const planned = cat.weeklyHoursTarget || 0;
			const actual = actualThisWeek[cat.id] || 0;
			const color = getCategoryColor($categories, cat.id) || 'var(--accent)';
			const maxVal = Math.max(planned, actual, 1);
			return {
				name: `${cat.icon} ${cat.name}`,
				planned,
				actual,
				color,
				plannedPct: (planned / maxVal) * 100,
				actualPct: (actual / maxVal) * 100
			};
		});
	});

	// --- Category Breakdown ---
	let categoryBreakdownData = $derived.by(() => {
		let total = 0;
		const map = {};
		for (const s of $focusSessions) {
			const catId = s.categoryId || 'unknown';
			const dur = (s.duration || 0) / 60;
			map[catId] = (map[catId] || 0) + dur;
			total += dur;
		}
		if (total === 0) return [];
		return Object.keys(map)
			.sort((a, b) => map[b] - map[a])
			.map(catId => {
				const hours = map[catId];
				const pct = ((hours / total) * 100).toFixed(1);
				const cat = getCategoryById($categories, catId);
				const color = getCategoryColor($categories, catId) || 'var(--accent)';
				const name = cat ? `${cat.icon} ${cat.name}` : catId;
				return { catId, hours, pct, name, color };
			});
	});

	// --- Heatmap (12 weeks = 84 days) ---
	let heatmapCells = $derived.by(() => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const sessionsByDay = {};
		for (const s of $focusSessions) {
			const d = new Date(s.startTime || s.endTime);
			const key = d.toISOString().split('T')[0];
			sessionsByDay[key] = (sessionsByDay[key] || 0) + 1;
		}

		const cells = [];
		for (let row = 0; row < 7; row++) {
			for (let col = 0; col < 12; col++) {
				const daysAgo = (11 - col) * 7 + (6 - row);
				const date = new Date(today);
				date.setDate(date.getDate() - daysAgo);
				const key = date.toISOString().split('T')[0];
				const count = sessionsByDay[key] || 0;

				let level = 0;
				if (count >= 5) level = 5;
				else if (count >= 4) level = 4;
				else if (count >= 3) level = 3;
				else if (count >= 2) level = 2;
				else if (count >= 1) level = 1;

				cells.push({ key, count, level });
			}
		}
		return cells;
	});
</script>

<div class="page-header">
	<h1 class="page-title">Performance Analytics</h1>
	<p class="page-subtitle">Understand how you spend your time</p>
</div>

<!-- Deep Work Stats -->
<div class="grid-stats mb-3">
	<div class="card stat-card">
		<div class="stat-number accent">{totalSessions}</div>
		<div class="stat-label">Total Focus Sessions</div>
	</div>
	<div class="card stat-card">
		<div class="stat-number success">{(totalMinutes / 60).toFixed(1)}h</div>
		<div class="stat-label">Total Focus Hours</div>
	</div>
	<div class="card stat-card">
		<div class="stat-number warning">{avgDuration}m</div>
		<div class="stat-label">Avg Session Duration</div>
	</div>
	<div class="card stat-card">
		<div class="stat-number">{avgDistractions}</div>
		<div class="stat-label">Avg Distractions</div>
	</div>
</div>

<div class="grid-2">
	<!-- Hours by Category -->
	<div class="card">
		<div class="card-header">
			<h2 class="card-title">Hours by Category</h2>
		</div>
		<div class="card-body">
			{#if categoryBarData.length === 0}
				<div class="empty-state">
					<div class="empty-state-icon">&#128200;</div>
					<div class="empty-state-title">No data yet</div>
					<div class="empty-state-text">Complete focus sessions to see analytics</div>
				</div>
			{:else}
				{#each categoryBarData as bar}
					<div style="margin-bottom:var(--space-md)">
						<div class="flex-between text-sm mb-1">
							<span>{bar.name}</span>
							<span class="text-muted">{bar.hours.toFixed(1)}h</span>
						</div>
						<div style="height:8px;background:var(--bg-primary);border-radius:4px;overflow:hidden">
							<div style="height:100%;width:{bar.pct}%;background:{bar.color};border-radius:4px;transition:width 0.4s ease"></div>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>

	<!-- Planned vs Actual -->
	<div class="card">
		<div class="card-header">
			<h2 class="card-title">Planned vs Actual Hours</h2>
		</div>
		<div class="card-body">
			{#if $categories.length === 0}
				<div class="empty-state">
					<div class="empty-state-title">No categories</div>
				</div>
			{:else}
				{#each plannedVsActualData as item}
					<div style="margin-bottom:var(--space-md)">
						<div class="flex-between text-sm mb-1">
							<span>{item.name}</span>
							<span class="text-muted">{item.actual.toFixed(1)}h / {item.planned}h</span>
						</div>
						<div style="position:relative;height:16px;background:var(--bg-primary);border-radius:4px;overflow:hidden">
							<div style="position:absolute;height:100%;width:{item.plannedPct}%;background:{item.color}33;border-radius:4px" title="Planned"></div>
							<div style="position:absolute;height:100%;width:{item.actualPct}%;background:{item.color};border-radius:4px" title="Actual"></div>
						</div>
					</div>
				{/each}
				<div class="flex gap-2 mt-2 text-xs text-muted">
					<span><span style="display:inline-block;width:12px;height:8px;border-radius:2px;background:var(--accent)33"></span> Planned</span>
					<span><span style="display:inline-block;width:12px;height:8px;border-radius:2px;background:var(--accent)"></span> Actual</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- Category Breakdown -->
	<div class="card">
		<div class="card-header">
			<h2 class="card-title">Category Breakdown</h2>
		</div>
		<div class="card-body">
			{#if categoryBreakdownData.length === 0}
				<div class="empty-state">
					<div class="empty-state-icon">&#128202;</div>
					<div class="empty-state-title">No data yet</div>
				</div>
			{:else}
				{#each categoryBreakdownData as item}
					<div class="list-item">
						<div style="width:12px;height:12px;border-radius:50%;background:{item.color};flex-shrink:0"></div>
						<div class="flex-1">
							<div class="text-sm font-bold">{item.name}</div>
							<div class="text-xs text-muted">{item.hours.toFixed(1)}h</div>
						</div>
						<span class="badge" style="background:{item.color}22;color:{item.color}">{item.pct}%</span>
					</div>
				{/each}
			{/if}
		</div>
	</div>

	<!-- Activity Heatmap -->
	<div class="card">
		<div class="card-header">
			<h2 class="card-title">Activity Heatmap (12 weeks)</h2>
		</div>
		<div class="card-body">
			<div class="heatmap-grid" style="display:grid;grid-template-columns:repeat(12,1fr);grid-template-rows:repeat(7,1fr);gap:3px">
				{#each heatmapCells as cell}
					<div class="heatmap-cell level-{cell.level}" title="{cell.key}: {cell.count} session{cell.count !== 1 ? 's' : ''}"></div>
				{/each}
			</div>
			<div class="flex-between mt-2 text-xs text-muted">
				<span>Less</span>
				<div class="flex gap-1">
					<div style="width:12px;height:12px;border-radius:3px;background:var(--bg-primary)"></div>
					<div style="width:12px;height:12px;border-radius:3px;background:rgba(0,212,255,0.15)"></div>
					<div style="width:12px;height:12px;border-radius:3px;background:rgba(0,212,255,0.3)"></div>
					<div style="width:12px;height:12px;border-radius:3px;background:rgba(0,212,255,0.5)"></div>
					<div style="width:12px;height:12px;border-radius:3px;background:var(--accent)"></div>
				</div>
				<span>More</span>
			</div>
		</div>
	</div>
</div>
