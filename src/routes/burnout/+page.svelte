<script>
	import { moodEntries, tasks, focusSessions } from '$lib/stores/data.js';

	// Helpers
	function daysAgo(n) {
		const d = new Date();
		d.setDate(d.getDate() - n);
		return d.toISOString().slice(0, 10);
	}

	let last7Moods = $derived.by(() => {
		const sorted = $moodEntries
			.slice()
			.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
		return sorted.slice(-7);
	});

	// Compute risk factors
	let factors = $derived.by(() => {
		const result = {};

		// 1. Consecutive heavy days (8+ hours of focus)
		let heavyDays = 0;
		for (let d = 0; d < 7; d++) {
			const dayStr = daysAgo(d);
			let dayHours = 0;
			for (const f of $focusSessions) {
				const sDate = (f.startTime || f.endTime || '').slice(0, 10);
				if (sDate === dayStr) dayHours += (f.duration || 0) / 60;
			}
			if (dayHours >= 8) heavyDays++;
			else if (d > 0) break;
		}
		result.heavyDays = {
			label: 'Consecutive Heavy Days',
			value: heavyDays,
			risk: heavyDays >= 5 ? 3 : heavyDays >= 3 ? 2 : heavyDays >= 1 ? 1 : 0,
			description: heavyDays + ' day(s) with 8+ hours of work in a row'
		};

		// 2. Sleep trend
		let avgSleep = 0;
		if (last7Moods.length > 0) {
			avgSleep =
				last7Moods.reduce((s, e) => s + (e.sleep || 0), 0) / last7Moods.length;
		}
		result.sleep = {
			label: 'Sleep Trend',
			value: avgSleep.toFixed(1) + 'h avg',
			risk: avgSleep < 5 ? 3 : avgSleep < 6 ? 2 : avgSleep < 7 ? 1 : 0,
			description:
				avgSleep < 6
					? 'Dangerously low sleep'
					: avgSleep < 7
						? 'Below recommended 7h'
						: 'Sleep is adequate'
		};

		// 3. Stress trend
		let avgStress = 0;
		if (last7Moods.length > 0) {
			avgStress =
				last7Moods.reduce((s, e) => s + (e.stress || 0), 0) / last7Moods.length;
		}
		result.stress = {
			label: 'Stress Trend',
			value: avgStress.toFixed(1) + '/10',
			risk: avgStress >= 8 ? 3 : avgStress >= 6 ? 2 : avgStress >= 4 ? 1 : 0,
			description:
				avgStress >= 8
					? 'Critical stress levels'
					: avgStress >= 6
						? 'Elevated stress'
						: 'Stress under control'
		};

		// 4. Overdue tasks
		const today = new Date().toISOString().slice(0, 10);
		const overdueCount = $tasks.filter(
			(t) => !t.completed && t.dueDate && t.dueDate < today
		).length;
		result.overdue = {
			label: 'Overdue Tasks',
			value: overdueCount,
			risk: overdueCount >= 5 ? 3 : overdueCount >= 3 ? 2 : overdueCount >= 1 ? 1 : 0,
			description:
				overdueCount === 0 ? 'All caught up!' : overdueCount + ' task(s) past due'
		};

		// 5. Rest days in last 7
		let restDays = 0;
		for (let rd = 0; rd < 7; rd++) {
			const rdStr = daysAgo(rd);
			let dayWork = 0;
			for (const f of $focusSessions) {
				const rDate = (f.startTime || f.endTime || '').slice(0, 10);
				if (rDate === rdStr) dayWork += (f.duration || 0) / 60;
			}
			if (dayWork < 1) restDays++;
		}
		result.restDays = {
			label: 'Rest Days (Last 7)',
			value: restDays,
			risk: restDays === 0 ? 3 : restDays === 1 ? 2 : restDays < 2 ? 1 : 0,
			description:
				restDays === 0
					? 'No rest days! Take a break!'
					: restDays + ' rest day(s) in the last week'
		};

		return result;
	});

	// Overall risk
	let overall = $derived.by(() => {
		const keys = Object.keys(factors);
		const totalRisk = keys.reduce((s, k) => s + factors[k].risk, 0);
		const maxRisk = keys.length * 3;
		const pct = (totalRisk / maxRisk) * 100;

		if (pct >= 70) return { level: 'Critical', color: 'var(--danger)', badge: 'badge-danger', pct };
		if (pct >= 45) return { level: 'High', color: 'var(--warning)', badge: 'badge-warning', pct };
		if (pct >= 20)
			return { level: 'Medium', color: 'var(--cat-orange)', badge: 'badge-warning', pct };
		return { level: 'Low', color: 'var(--success)', badge: 'badge-success', pct };
	});

	// Recommendations
	let recommendations = $derived.by(() => {
		const recs = [];

		if (factors.heavyDays.risk >= 2) {
			recs.push({
				icon: '&#x1F6CC;',
				text:
					"You've been working intensely for " +
					factors.heavyDays.value +
					' days straight. Schedule a light day or rest day tomorrow.'
			});
		}
		if (factors.sleep.risk >= 2) {
			recs.push({
				icon: '&#x1F634;',
				text: 'Your sleep is below 6 hours on average. Prioritize getting to bed earlier tonight.'
			});
		} else if (factors.sleep.risk === 1) {
			recs.push({
				icon: '&#x1F319;',
				text: 'Aim for 7+ hours of sleep. Small improvements compound over time.'
			});
		}
		if (factors.stress.risk >= 2) {
			recs.push({
				icon: '&#x1F9D8;',
				text: 'Stress levels are elevated. Consider a short meditation, walk, or break between tasks.'
			});
		}
		if (factors.overdue.risk >= 1) {
			recs.push({
				icon: '&#x1F4CB;',
				text:
					'You have ' +
					factors.overdue.value +
					' overdue task(s). Knock out the smallest one first to build momentum.'
			});
		}
		if (factors.restDays.risk >= 2) {
			recs.push({
				icon: '&#x2600;&#xFE0F;',
				text: "You haven't had enough rest days. Block off time for recovery -- it boosts long-term productivity."
			});
		}

		if (recs.length === 0) {
			recs.push({
				icon: '&#x2705;',
				text: 'All indicators look healthy! Keep maintaining your current balance.'
			});
		}

		return recs;
	});

	const riskColors = ['var(--success)', 'var(--cat-orange)', 'var(--warning)', 'var(--danger)'];
	const riskLabels = ['OK', 'Watch', 'Warning', 'Critical'];
</script>

<div class="page-header">
	<h1 class="page-title">Burnout Monitor</h1>
	<p class="page-subtitle">Stay aware of burnout risk factors before they become problems</p>
</div>

<!-- Risk Meter -->
<div class="card mb-3">
	<div class="card-header">
		<h2 class="card-title">Overall Burnout Risk</h2>
	</div>
	<div class="card-body">
		<div style="text-align:center;margin-bottom:var(--space-lg)">
			<span
				class="badge badge-lg {overall.badge}"
				style="font-size:var(--font-size-lg);padding:8px 24px"
			>
				{overall.level} Risk
			</span>
		</div>
		<div
			style="position:relative;height:24px;border-radius:12px;overflow:hidden;background:linear-gradient(to right, var(--success), var(--cat-orange), var(--danger))"
		>
			<div
				style="position:absolute;left:{overall.pct}%;top:-4px;bottom:-4px;width:4px;background:white;border-radius:2px;box-shadow:0 0 8px rgba(255,255,255,0.5);transform:translateX(-50%)"
			></div>
		</div>
		<div class="flex-between mt-1">
			<span class="text-xs text-success">Low</span>
			<span class="text-xs text-warning">Medium</span>
			<span class="text-xs text-danger">Critical</span>
		</div>
	</div>
</div>

<!-- Factor Cards -->
<div class="grid-dashboard mb-3">
	{#each Object.keys(factors) as key}
		{@const f = factors[key]}
		{@const riskColor = riskColors[f.risk]}
		{@const riskLabel = riskLabels[f.risk]}
		<div class="card">
			<div class="card-header">
				<h3 class="card-title" style="font-size:var(--font-size-md)">{f.label}</h3>
				<span class="badge" style="background:{riskColor}20;color:{riskColor}">{riskLabel}</span>
			</div>
			<div class="card-body">
				<div class="stat-number" style="font-size:var(--font-size-xl);color:{riskColor}">
					{f.value}
				</div>
				<p class="text-sm text-secondary mt-1">{f.description}</p>
			</div>
		</div>
	{/each}
</div>

<!-- Stress Trend Mini Chart -->
<div class="card mb-3">
	<div class="card-header">
		<h2 class="card-title">Stress Trend (7 days)</h2>
	</div>
	<div class="card-body">
		{#if last7Moods.length === 0}
			<p class="text-muted text-center">No mood data for the last 7 days</p>
		{:else}
			<div style="display:flex;align-items:flex-end;gap:6px;height:100px">
				{#each last7Moods as entry}
					{@const val = entry.stress || 0}
					{@const pct = (val / 10) * 100}
					{@const color = val >= 8 ? 'var(--danger)' : val >= 5 ? 'var(--warning)' : 'var(--success)'}
					<div
						style="flex:1;display:flex;flex-direction:column;align-items:center;height:100%"
					>
						<span class="text-xs" style="color:var(--text-secondary);margin-bottom:2px"
							>{val}</span
						>
						<div style="flex:1;width:100%;display:flex;align-items:flex-end">
							<div
								style="width:100%;height:{pct}%;background:{color};border-radius:4px 4px 0 0;min-height:2px"
							></div>
						</div>
						<span class="text-xs text-muted" style="margin-top:4px"
							>{entry.date.slice(5)}</span
						>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- Recommendations -->
<div class="card">
	<div class="card-header">
		<h2 class="card-title">Smart Recommendations</h2>
	</div>
	<div class="card-body">
		{#each recommendations as rec}
			<div class="list-item">
				<span style="font-size:1.2rem;margin-right:8px">{@html rec.icon}</span>
				<span>{rec.text}</span>
			</div>
		{/each}
	</div>
</div>
