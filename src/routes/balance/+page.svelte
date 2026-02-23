<script>
	import { categories, focusSessions, schedule } from '$lib/stores/data.js';
	import { getCategoryColor } from '$lib/helpers.js';

	// --- Actual hours this week per category ---
	let actualHours = $derived.by(() => {
		const now = new Date();
		const dayOfWeek = now.getDay();
		const weekStart = new Date(now);
		weekStart.setDate(weekStart.getDate() - dayOfWeek);
		weekStart.setHours(0, 0, 0, 0);

		const hours = {};
		for (const cat of $categories) hours[cat.id] = 0;

		for (const s of $focusSessions) {
			const sDate = new Date(s.startTime || s.endTime);
			if (sDate >= weekStart && s.categoryId && hours[s.categoryId] !== undefined) {
				hours[s.categoryId] += (s.duration || 0) / 60;
			}
		}

		for (const blk of $schedule) {
			if (!blk.categoryId || hours[blk.categoryId] === undefined) continue;
			if (blk.startTime && blk.endTime) {
				const start = new Date(blk.startTime);
				const end = new Date(blk.endTime);
				if (start >= weekStart) {
					hours[blk.categoryId] += (end - start) / (1000 * 60 * 60);
				}
			}
		}

		return hours;
	});

	// --- Balance Score ---
	let balanceScore = $derived.by(() => {
		if ($categories.length === 0) return 0;
		let totalDeviation = 0;
		for (const cat of $categories) {
			const target = cat.weeklyHoursTarget || 0;
			const actual = actualHours[cat.id] || 0;
			if (target > 0) {
				const ratio = actual / target;
				totalDeviation += Math.abs(1 - ratio);
			}
		}
		const avgDeviation = totalDeviation / $categories.length;
		const score = Math.max(0, Math.round((1 - avgDeviation) * 100));
		return Math.min(100, score);
	});

	let scoreClass = $derived(balanceScore >= 75 ? 'success' : balanceScore >= 50 ? 'warning' : 'danger');

	// --- Donut Chart ---
	let totalActual = $derived($categories.reduce((sum, cat) => sum + (actualHours[cat.id] || 0), 0));

	let donutGradient = $derived.by(() => {
		if (totalActual === 0) return '';
		const parts = [];
		let cumPct = 0;
		for (const cat of $categories) {
			const pct = ((actualHours[cat.id] || 0) / totalActual) * 100;
			if (pct > 0) {
				const color = getCategoryColor($categories, cat.id) || 'var(--accent)';
				parts.push(`${color} ${cumPct}% ${cumPct + pct}%`);
				cumPct += pct;
			}
		}
		return parts.length > 0 ? `conic-gradient(${parts.join(', ')})` : '';
	});

	// --- Bars Data ---
	let maxBarHours = $derived.by(() => {
		let max = 0;
		for (const cat of $categories) {
			const target = cat.weeklyHoursTarget || 0;
			const actual = actualHours[cat.id] || 0;
			if (target > max) max = target;
			if (actual > max) max = actual;
		}
		return max || 1;
	});

	let barData = $derived.by(() => {
		return $categories.map(cat => {
			const target = cat.weeklyHoursTarget || 0;
			const actual = actualHours[cat.id] || 0;
			const color = getCategoryColor($categories, cat.id) || 'var(--accent)';
			const targetPct = (target / maxBarHours) * 100;
			const actualPct = (actual / maxBarHours) * 100;

			let badge = '';
			let badgeClass = '';
			if (target > 0) {
				const ratio = actual / target;
				if (ratio < 0.25) { badge = 'Neglected'; badgeClass = 'badge-danger'; }
				else if (ratio < 0.6) { badge = 'Below target'; badgeClass = 'badge-warning'; }
				else if (ratio > 1.5) { badge = 'Dominating'; badgeClass = 'badge-warning'; }
			}

			return { cat, target, actual, color, targetPct, actualPct, badge, badgeClass };
		});
	});

	// --- Suggestions ---
	let suggestions = $derived.by(() => {
		const items = [];
		for (const cat of $categories) {
			const target = cat.weeklyHoursTarget || 0;
			const actual = actualHours[cat.id] || 0;
			if (target > 0) {
				const ratio = actual / target;
				if (ratio < 0.25) {
					items.push({ icon: '\u{1F534}', text: `${cat.name} is severely neglected. Try scheduling at least ${Math.ceil(target * 0.5)}h this week.` });
				} else if (ratio < 0.6) {
					items.push({ icon: '\u{1F7E1}', text: `${cat.name} is below target. Consider adding ${(target - actual).toFixed(1)} more hours.` });
				} else if (ratio > 1.5) {
					items.push({ icon: '\u{1F7E0}', text: `${cat.name} is dominating your time. Consider redistributing ${(actual - target).toFixed(1)}h to other areas.` });
				}
			}
		}
		if (items.length === 0) {
			items.push({ icon: '\u2705', text: 'Your life balance looks great! Keep maintaining your schedule.' });
		}
		return items;
	});
</script>

<div class="page-header">
	<h1 class="page-title">Life Balance</h1>
	<p class="page-subtitle">How well your actual time matches your targets</p>
</div>

<!-- Score + Donut Row -->
<div class="grid-2 mb-3">
	<div class="card stat-card" id="balance-score-card">
		<div class="stat-number {scoreClass}">{balanceScore}</div>
		<div class="stat-label">Balance Score</div>
		<div class="stat-sublabel">out of 100</div>
	</div>
	<div class="card" style="display:flex;align-items:center;justify-content:center">
		{#if totalActual === 0}
			<span class="text-muted">No data</span>
		{:else}
			<div style="width:200px;height:200px;border-radius:50%;position:relative;background:{donutGradient}">
				<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:120px;height:120px;border-radius:50%;background:var(--bg-card);display:flex;align-items:center;justify-content:center;flex-direction:column">
					<span style="font-size:var(--font-size-sm);color:var(--text-secondary)">Total</span>
					<span style="font-size:var(--font-size-lg);font-weight:700;color:var(--text-primary)">{totalActual.toFixed(1)}h</span>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Category Bars -->
<div class="card mb-3">
	<div class="card-header">
		<h2 class="card-title">Target vs Actual Hours (This Week)</h2>
	</div>
	<div class="card-body">
		{#if $categories.length === 0}
			<p class="text-muted">No categories defined.</p>
		{:else}
			{#each barData as item}
				<div style="margin-bottom:var(--space-lg)">
					<div class="flex-between mb-1">
						<span style="font-weight:600">
							{item.cat.icon} {item.cat.name}
							{#if item.badge}
								<span class="badge {item.badgeClass}" style="margin-left:8px">{item.badge}</span>
							{/if}
						</span>
						<span class="text-sm text-secondary">{item.actual.toFixed(1)}h / {item.target}h</span>
					</div>
					<div style="display:flex;gap:4px;align-items:center">
						<span class="text-xs text-muted" style="width:50px">Target</span>
						<div style="flex:1;height:8px;background:var(--bg-primary);border-radius:4px;overflow:hidden">
							<div style="width:{item.targetPct}%;height:100%;background:{item.color};opacity:0.3;border-radius:4px"></div>
						</div>
					</div>
					<div style="display:flex;gap:4px;align-items:center;margin-top:3px">
						<span class="text-xs text-muted" style="width:50px">Actual</span>
						<div style="flex:1;height:8px;background:var(--bg-primary);border-radius:4px;overflow:hidden">
							<div style="width:{item.actualPct}%;height:100%;background:{item.color};border-radius:4px"></div>
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<!-- Suggestions -->
<div class="card">
	<div class="card-header">
		<h2 class="card-title">Suggestions</h2>
	</div>
	<div class="card-body">
		{#each suggestions as s}
			<div class="list-item">
				<span style="font-size:1.2rem;margin-right:8px">{s.icon}</span>
				<span>{s.text}</span>
			</div>
		{/each}
	</div>
</div>
