<script>
	import { categories, schedule, saveStore } from '$lib/stores/data.js';
	import {
		generateId,
		formatDate,
		formatTime,
		getCategoryById,
		getCategoryColor,
		COLOR_MAP
	} from '$lib/helpers.js';
	import { showToast } from '$lib/stores/toast.js';
	import CategoryBadge from '$lib/components/CategoryBadge.svelte';

	/* ======================================================================
	   CONSTANTS
	   ====================================================================== */
	const MONTH_NAMES = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];
	const MONTH_SHORT = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];
	const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const DAY_FULL = [
		'Monday',
		'Tuesday',
		'Wednesday',
		'Thursday',
		'Friday',
		'Saturday',
		'Sunday'
	];

	/* ======================================================================
	   STATE
	   ====================================================================== */
	let viewMode = $state('month');
	let currentDate = $state(new Date());

	/* ======================================================================
	   HELPERS
	   ====================================================================== */
	function padTime(n) {
		return n < 10 ? '0' + n : '' + n;
	}

	function sameDay(a, b) {
		return (
			a.getFullYear() === b.getFullYear() &&
			a.getMonth() === b.getMonth() &&
			a.getDate() === b.getDate()
		);
	}

	function isToday(d) {
		return sameDay(d, new Date());
	}

	function toDateStr(d) {
		return d.getFullYear() + '-' + padTime(d.getMonth() + 1) + '-' + padTime(d.getDate());
	}

	function getMondayOfWeek(d) {
		const date = new Date(d);
		const day = date.getDay();
		const diff = (day === 0 ? -6 : 1) - day;
		date.setDate(date.getDate() + diff);
		date.setHours(0, 0, 0, 0);
		return date;
	}

	function formatHourLabel(h) {
		if (h === 0 || h === 24) return '12 AM';
		if (h < 12) return h + ' AM';
		if (h === 12) return '12 PM';
		return h - 12 + ' PM';
	}

	function to12Hour(h24, m) {
		const ampm = h24 >= 12 ? 'PM' : 'AM';
		let h12 = h24 % 12;
		if (h12 === 0) h12 = 12;
		return { hour: h12, minute: m, ampm };
	}

	function to24Hour(h12, m, ampm) {
		let h24 = h12;
		if (ampm === 'AM') {
			if (h12 === 12) h24 = 0;
		} else {
			if (h12 !== 12) h24 = h12 + 12;
		}
		return { hour: h24, minute: m };
	}

	function roundMinute(m) {
		return ((Math.round(m / 5) * 5) % 60);
	}

	/* ---- Item query helpers ---- */
	function getItemsForDate(date) {
		const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
		const ds = toDateStr(date);
		const result = [];

		for (const item of $schedule) {
			if (item.recurring && item.days && item.days.indexOf(dayName) !== -1) {
				result.push(item);
			} else if (item.allDay && item.startTime && item.endTime) {
				const startD = item.startTime.split('T')[0];
				const endD = item.endTime.split('T')[0];
				if (ds >= startD && ds <= endD) {
					result.push(item);
				}
			} else if (item.startTime && item.startTime.indexOf(ds) === 0) {
				result.push(item);
			}
		}

		result.sort((a, b) => {
			if (a.allDay && !b.allDay) return -1;
			if (!a.allDay && b.allDay) return 1;
			const aTime = a.startTime ? a.startTime.split('T')[1] || '00:00' : '00:00';
			const bTime = b.startTime ? b.startTime.split('T')[1] || '00:00' : '00:00';
			return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
		});

		return result;
	}

	function getTimedItemsForDate(date) {
		return getItemsForDate(date).filter((item) => !item.allDay);
	}

	function getAllDayItemsForDate(date) {
		return getItemsForDate(date).filter((item) => !!item.allDay);
	}

	function getItemTimes(item, date) {
		if (!item.startTime || !item.endTime) return null;
		if (item.allDay) return null;

		if (item.recurring) {
			const sTime = item.startTime.split('T')[1] || '00:00:00';
			const eTime = item.endTime.split('T')[1] || '00:00:00';
			const sParts = sTime.split(':');
			const eParts = eTime.split(':');

			const start = new Date(date);
			start.setHours(parseInt(sParts[0]) || 0, parseInt(sParts[1]) || 0, 0, 0);
			const end = new Date(date);
			end.setHours(parseInt(eParts[0]) || 0, parseInt(eParts[1]) || 0, 0, 0);
			return { start, end };
		}

		return { start: new Date(item.startTime), end: new Date(item.endTime) };
	}

	/* ---- Navigation ---- */
	function navigate(dir) {
		if (viewMode === 'month') {
			currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1);
		} else if (viewMode === 'week') {
			currentDate = new Date(currentDate.getTime() + dir * 7 * 86400000);
		} else {
			currentDate = new Date(currentDate.getTime() + dir * 86400000);
		}
	}

	function goToday() {
		currentDate = new Date();
	}

	/* ---- Subtitle ---- */
	let subtitle = $derived.by(() => {
		if (viewMode === 'month') {
			return MONTH_NAMES[currentDate.getMonth()] + ' ' + currentDate.getFullYear();
		} else if (viewMode === 'week') {
			const mon = getMondayOfWeek(currentDate);
			const sun = new Date(mon);
			sun.setDate(sun.getDate() + 6);
			return (
				MONTH_SHORT[mon.getMonth()] +
				' ' +
				mon.getDate() +
				' - ' +
				MONTH_SHORT[sun.getMonth()] +
				' ' +
				sun.getDate() +
				', ' +
				sun.getFullYear()
			);
		} else {
			const dayIdx = currentDate.getDay();
			const fullDayIdx = dayIdx === 0 ? 6 : dayIdx - 1;
			return (
				DAY_FULL[fullDayIdx] +
				', ' +
				MONTH_NAMES[currentDate.getMonth()] +
				' ' +
				currentDate.getDate() +
				', ' +
				currentDate.getFullYear()
			);
		}
	});

	/* ======================================================================
	   MONTH VIEW DATA
	   ====================================================================== */
	let monthCells = $derived.by(() => {
		const year = currentDate.getFullYear();
		const month = currentDate.getMonth();
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const startDow = firstDay.getDay();
		const startOffset = startDow === 0 ? 6 : startDow - 1;
		const totalDays = lastDay.getDate();
		const totalCells = startOffset + totalDays;
		const rows = Math.ceil(totalCells / 7);
		const totalSlots = rows * 7;

		const cells = [];
		for (let i = 0; i < totalSlots; i++) {
			const dayNum = i - startOffset + 1;
			const cellDate = new Date(year, month, dayNum);
			const isOutside = dayNum < 1 || dayNum > totalDays;
			const isTodayCell = !isOutside && isToday(cellDate);
			const items = isOutside ? [] : getItemsForDate(cellDate);
			cells.push({
				date: cellDate,
				dayNum: cellDate.getDate(),
				isOutside,
				isToday: isTodayCell,
				items,
				dateStr: toDateStr(cellDate)
			});
		}
		return cells;
	});

	function handleMonthCellClick(cell) {
		if (cell.isOutside) return;
		currentDate = new Date(cell.dateStr + 'T12:00:00');
		viewMode = 'day';
	}

	function handleMonthMoreClick(cell) {
		currentDate = new Date(cell.dateStr + 'T12:00:00');
		viewMode = 'day';
	}

	/* ======================================================================
	   WEEK VIEW DATA
	   ====================================================================== */
	const WEEK_START_HOUR = 0;
	const WEEK_END_HOUR = 24;
	const WEEK_ROW_HEIGHT = 48;

	let weekData = $derived.by(() => {
		const monday = getMondayOfWeek(currentDate);
		const totalHours = WEEK_END_HOUR - WEEK_START_HOUR;

		const dayColumns = [];
		let hasAnyAllDay = false;

		for (let d = 0; d < 7; d++) {
			const dayDate = new Date(monday);
			dayDate.setDate(dayDate.getDate() + d);
			const allDayItems = getAllDayItemsForDate(dayDate);
			const timedItems = getTimedItemsForDate(dayDate);
			if (allDayItems.length > 0) hasAnyAllDay = true;
			dayColumns.push({
				date: dayDate,
				dayNum: dayDate.getDate(),
				dayName: DAY_NAMES[d],
				isToday: isToday(dayDate),
				allDayItems,
				timedItems
			});
		}

		// Build event blocks for timed items
		const eventBlocks = [];
		for (let d = 0; d < 7; d++) {
			const dayDate = dayColumns[d].date;
			for (const item of dayColumns[d].timedItems) {
				const times = getItemTimes(item, dayDate);
				if (!times) continue;

				let startMin = times.start.getHours() * 60 + times.start.getMinutes();
				let endMin = times.end.getHours() * 60 + times.end.getMinutes();
				const gridStartMin = WEEK_START_HOUR * 60;
				const gridEndMin = WEEK_END_HOUR * 60;

				if (endMin <= gridStartMin || startMin >= gridEndMin) continue;
				if (startMin < gridStartMin) startMin = gridStartMin;
				if (endMin > gridEndMin) endMin = gridEndMin;

				const topPx = ((startMin - gridStartMin) / 60) * WEEK_ROW_HEIGHT;
				let heightPx = ((endMin - startMin) / 60) * WEEK_ROW_HEIGHT;
				if (heightPx < 20) heightPx = 20;

				const color = getCategoryColor($categories, item.categoryId);
				const timeLabel = formatTime(times.start) + ' - ' + formatTime(times.end);

				eventBlocks.push({
					item,
					column: d + 2,
					topPx,
					heightPx,
					color,
					timeLabel,
					totalHours
				});
			}
		}

		// Now line
		const now = new Date();
		let nowLine = null;
		for (let nd = 0; nd < 7; nd++) {
			if (isToday(dayColumns[nd].date)) {
				const nowMin = now.getHours() * 60 + now.getMinutes();
				if (nowMin >= WEEK_START_HOUR * 60 && nowMin < WEEK_END_HOUR * 60) {
					nowLine = {
						column: nd + 2,
						topPx: ((nowMin - WEEK_START_HOUR * 60) / 60) * WEEK_ROW_HEIGHT,
						totalHours
					};
				}
				break;
			}
		}

		// Hours array for labels
		const hours = [];
		for (let h = WEEK_START_HOUR; h < WEEK_END_HOUR; h++) {
			hours.push({ hour: h, row: h - WEEK_START_HOUR + 1 });
		}

		return { monday, dayColumns, hasAnyAllDay, eventBlocks, nowLine, hours, totalHours };
	});

	function handleWeekSlotClick(dayIdx, hour) {
		const mon = getMondayOfWeek(currentDate);
		const slotDate = new Date(mon);
		slotDate.setDate(slotDate.getDate() + dayIdx);
		openScheduleModal(null, toDateStr(slotDate), padTime(hour) + ':00');
	}

	/* ======================================================================
	   DAY VIEW DATA
	   ====================================================================== */
	const DAY_START_HOUR = 0;
	const DAY_END_HOUR = 24;
	const DAY_ROW_HEIGHT = 56;

	let dayData = $derived.by(() => {
		const totalHours = DAY_END_HOUR - DAY_START_HOUR;
		const allDayItems = getAllDayItemsForDate(currentDate);
		const timedItems = getTimedItemsForDate(currentDate);

		const eventBlocks = [];
		for (const item of timedItems) {
			const times = getItemTimes(item, currentDate);
			if (!times) continue;

			let startMin = times.start.getHours() * 60 + times.start.getMinutes();
			let endMin = times.end.getHours() * 60 + times.end.getMinutes();
			const gridStartMin = DAY_START_HOUR * 60;
			const gridEndMin = DAY_END_HOUR * 60;

			if (endMin <= gridStartMin || startMin >= gridEndMin) continue;
			if (startMin < gridStartMin) startMin = gridStartMin;
			if (endMin > gridEndMin) endMin = gridEndMin;

			const topPx = ((startMin - gridStartMin) / 60) * DAY_ROW_HEIGHT;
			let heightPx = ((endMin - startMin) / 60) * DAY_ROW_HEIGHT;
			if (heightPx < 24) heightPx = 24;

			const color = getCategoryColor($categories, item.categoryId);
			const timeLabel = formatTime(times.start) + ' - ' + formatTime(times.end);
			const cat = getCategoryById($categories, item.categoryId);
			const catLabel = cat ? cat.icon + ' ' + cat.name : '';

			eventBlocks.push({ item, topPx, heightPx, color, timeLabel, catLabel, totalHours });
		}

		// Now line
		let nowLine = null;
		if (isToday(currentDate)) {
			const now = new Date();
			const nowMin = now.getHours() * 60 + now.getMinutes();
			if (nowMin >= DAY_START_HOUR * 60 && nowMin < DAY_END_HOUR * 60) {
				nowLine = {
					topPx: ((nowMin - DAY_START_HOUR * 60) / 60) * DAY_ROW_HEIGHT,
					totalHours
				};
			}
		}

		const hours = [];
		for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
			hours.push({ hour: h, row: h - DAY_START_HOUR + 1 });
		}

		return { allDayItems, eventBlocks, nowLine, hours, totalHours };
	});

	function handleDaySlotClick(hour) {
		openScheduleModal(null, toDateStr(currentDate), padTime(hour) + ':00');
	}

	/* ======================================================================
	   EVENT MODAL STATE
	   ====================================================================== */
	let showEventModal = $state(false);
	let editingEvent = $state(null);

	let sfTitle = $state('');
	let sfCategory = $state('');
	let sfAllDay = $state(false);
	let sfRecurring = $state(false);
	let sfDays = $state([]);
	let sfDate = $state('');
	let sfStartDate = $state('');
	let sfEndDate = $state('');
	let sfStartHour = $state(9);
	let sfStartMin = $state(0);
	let sfStartAmpm = $state('AM');
	let sfEndHour = $state(10);
	let sfEndMin = $state(0);
	let sfEndAmpm = $state('AM');

	/* ---- Derived visibility ---- */
	let showTimeGroup = $derived(!sfAllDay);
	let showRecurringGroup = $derived(!sfAllDay);
	let showDaysGroup = $derived(!sfAllDay && sfRecurring);
	let showDateGroup = $derived(!sfAllDay && !sfRecurring);
	let showAllDayDates = $derived(sfAllDay);

	/* ---- Options arrays ---- */
	let hourOptions = Array.from({ length: 12 }, (_, i) => i + 1);
	let minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5);
	const dayNamesList = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	function openScheduleModal(item, prefillDate, prefillTime) {
		editingEvent = item || null;
		const isEdit = !!item;

		sfTitle = item ? item.title : '';
		sfCategory = item ? item.categoryId : $categories.length > 0 ? $categories[0].id : '';
		sfAllDay = item ? !!item.allDay : false;
		sfRecurring = item ? !!item.recurring : false;
		sfDays = item && item.days ? [...item.days] : [];

		let startDate = '';
		let endDate = '';
		let startH12 = 9,
			startMinVal = 0,
			startAMPM = 'AM';
		let endH12 = 10,
			endMinVal = 0,
			endAMPM = 'AM';

		if (item && item.startTime) {
			const st = new Date(item.startTime);
			startDate =
				st.getFullYear() +
				'-' +
				padTime(st.getMonth() + 1) +
				'-' +
				padTime(st.getDate());
			if (!item.allDay) {
				const stParts = to12Hour(st.getHours(), roundMinute(st.getMinutes()));
				startH12 = stParts.hour;
				startMinVal = stParts.minute;
				startAMPM = stParts.ampm;
			}
		}
		if (item && item.endTime) {
			const et = new Date(item.endTime);
			endDate =
				et.getFullYear() +
				'-' +
				padTime(et.getMonth() + 1) +
				'-' +
				padTime(et.getDate());
			if (!item.allDay) {
				const etParts = to12Hour(et.getHours(), roundMinute(et.getMinutes()));
				endH12 = etParts.hour;
				endMinVal = etParts.minute;
				endAMPM = etParts.ampm;
			}
		}

		if (!item && prefillDate) {
			startDate = prefillDate;
			endDate = prefillDate;
		}
		if (!item && !prefillDate) {
			startDate = toDateStr(new Date());
			endDate = toDateStr(new Date());
		}
		if (!item && prefillTime) {
			const ph = parseInt(prefillTime.split(':')[0]);
			const pm = parseInt(prefillTime.split(':')[1]) || 0;
			const pParts = to12Hour(ph, roundMinute(pm));
			startH12 = pParts.hour;
			startMinVal = pParts.minute;
			startAMPM = pParts.ampm;
			const ehour = Math.min(ph + 1, 23);
			const eParts2 = to12Hour(ehour, 0);
			endH12 = eParts2.hour;
			endMinVal = eParts2.minute;
			endAMPM = eParts2.ampm;
		}

		if (!endDate) endDate = startDate;

		sfDate = startDate;
		sfStartDate = startDate;
		sfEndDate = endDate;
		sfStartHour = startH12;
		sfStartMin = startMinVal;
		sfStartAmpm = startAMPM;
		sfEndHour = endH12;
		sfEndMin = endMinVal;
		sfEndAmpm = endAMPM;

		showEventModal = true;
	}

	function closeEventModal() {
		showEventModal = false;
		editingEvent = null;
	}

	function handleAllDayToggle() {
		if (sfAllDay) {
			sfRecurring = false;
			if (sfDate) {
				if (!sfStartDate) sfStartDate = sfDate;
				if (!sfEndDate) sfEndDate = sfDate;
			}
		} else {
			if (sfStartDate) sfDate = sfStartDate;
		}
	}

	function toggleDay(day) {
		if (sfDays.includes(day)) {
			sfDays = sfDays.filter((d) => d !== day);
		} else {
			sfDays = [...sfDays, day];
		}
	}

	async function handleEventSubmit(e) {
		e.preventDefault();
		if (!sfTitle.trim()) return;

		let startISO, endISO;
		let days = [];

		if (sfAllDay) {
			const sd = sfStartDate || toDateStr(new Date());
			const ed = sfEndDate || sd;
			startISO = sd + 'T00:00:00';
			endISO = ed + 'T23:59:00';
		} else {
			const dateVal = sfDate || toDateStr(new Date());

			if (sfRecurring) {
				days = [...sfDays];
			}

			const s24 = to24Hour(parseInt(sfStartHour), parseInt(sfStartMin), sfStartAmpm);
			const e24 = to24Hour(parseInt(sfEndHour), parseInt(sfEndMin), sfEndAmpm);

			startISO = dateVal + 'T' + padTime(s24.hour) + ':' + padTime(s24.minute) + ':00';
			endISO = dateVal + 'T' + padTime(e24.hour) + ':' + padTime(e24.minute) + ':00';
		}

		if (editingEvent) {
			$schedule = $schedule.map((s) => {
				if (s.id === editingEvent.id) {
					return {
						...s,
						title: sfTitle.trim(),
						categoryId: sfCategory,
						recurring: sfAllDay ? false : sfRecurring,
						days,
						startTime: startISO,
						endTime: endISO,
						allDay: sfAllDay
					};
				}
				return s;
			});
			await saveStore('schedule', $schedule);
			showToast('Event updated', 'success');
		} else {
			$schedule = [
				...$schedule,
				{
					id: generateId(),
					title: sfTitle.trim(),
					categoryId: sfCategory,
					startTime: startISO,
					endTime: endISO,
					recurring: sfAllDay ? false : sfRecurring,
					days,
					allDay: sfAllDay
				}
			];
			await saveStore('schedule', $schedule);
			showToast('Event added', 'success');
		}
		closeEventModal();
	}

	async function handleEventDelete() {
		if (!editingEvent) return;
		$schedule = $schedule.filter((s) => s.id !== editingEvent.id);
		await saveStore('schedule', $schedule);
		showToast('Event deleted', 'warning');
		closeEventModal();
	}

	function editEventById(id) {
		const item = ($schedule || []).find((s) => s.id === id);
		if (item) openScheduleModal(item, null);
	}

	function handleAddEvent() {
		let prefill = null;
		if (viewMode === 'day' || viewMode === 'week') {
			prefill = toDateStr(currentDate);
		}
		openScheduleModal(null, prefill);
	}
</script>

<div class="page-header flex-between">
	<div>
		<h1 class="page-title">Schedule</h1>
		<p class="page-subtitle">{subtitle}</p>
	</div>
	<div class="flex gap-1">
		<button class="btn btn-sm" onclick={() => navigate(-1)}>&larr;</button>
		<button class="btn btn-sm" onclick={goToday}>Today</button>
		<button class="btn btn-sm" onclick={() => navigate(1)}>&rarr;</button>
		<div class="flex gap-1" style="margin-left:var(--space-md)">
			<button
				class="btn btn-sm{viewMode === 'month' ? ' btn-primary' : ''}"
				onclick={() => (viewMode = 'month')}>Month</button
			>
			<button
				class="btn btn-sm{viewMode === 'week' ? ' btn-primary' : ''}"
				onclick={() => (viewMode = 'week')}>Week</button
			>
			<button
				class="btn btn-sm{viewMode === 'day' ? ' btn-primary' : ''}"
				onclick={() => (viewMode = 'day')}>Day</button
			>
		</div>
		<button class="btn btn-primary btn-sm" onclick={handleAddEvent}>+ Event</button>
	</div>
</div>

<div class="card" style="padding:0;overflow:hidden;">
	<!-- ====== MONTH VIEW ====== -->
	{#if viewMode === 'month'}
		<div class="cal-month-grid">
			{#each DAY_NAMES as name}
				<div class="cal-month-header">{name}</div>
			{/each}

			{#each monthCells as cell, i}
				<div
					class="cal-month-cell{cell.isOutside ? ' outside' : ''}{cell.isToday ? ' today' : ''}"
					data-date={cell.dateStr}
					onclick={() => handleMonthCellClick(cell)}
				>
					<div class="cal-day-number">{cell.dayNum}</div>
					{#if !cell.isOutside}
						{#each cell.items.slice(0, 3) as item (item.id)}
							{@const color = getCategoryColor($categories, item.categoryId)}
							<div
								class="cal-event-pill"
								style="background:{color}"
								onclick={(e) => { e.stopPropagation(); editEventById(item.id); }}
							>
								{item.title}
							</div>
						{/each}
						{#if cell.items.length > 3}
							<div
								class="cal-more-link"
								onclick={(e) => { e.stopPropagation(); handleMonthMoreClick(cell); }}
							>
								+{cell.items.length - 3} more
							</div>
						{/if}
					{/if}
				</div>
			{/each}
		</div>

		<!-- ====== WEEK VIEW ====== -->
	{:else if viewMode === 'week'}
		{#if weekData.hasAnyAllDay}
			<div class="cal-allday-section">
				<div style="display:grid;grid-template-columns:60px repeat(7,1fr);gap:2px">
					<div
						class="text-xs text-muted"
						style="display:flex;align-items:center;justify-content:flex-end;padding-right:var(--space-sm)"
					>
						all-day
					</div>
					{#each weekData.dayColumns as col, d}
						<div>
							{#each col.allDayItems as item (item.id)}
								{@const color = getCategoryColor($categories, item.categoryId)}
								<div
									class="cal-event-pill"
									style="background:{color}22;color:{color}"
									onclick={() => editEventById(item.id)}
								>
									{item.title}
								</div>
							{/each}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<div
			class="cal-week-header"
			style="grid-template-columns:60px repeat(7,1fr)"
		>
			<div
				class="cal-week-header-cell"
				style="border-right:1px solid var(--border-subtle)"
			></div>
			{#each weekData.dayColumns as col}
				<div class="cal-week-header-cell{col.isToday ? ' today' : ''}">
					{col.dayName} <strong>{col.dayNum}</strong>
				</div>
			{/each}
		</div>

		<div
			class="cal-time-grid"
			style="grid-template-columns:60px repeat(7,1fr);grid-template-rows:repeat({weekData.totalHours},{WEEK_ROW_HEIGHT}px)"
		>
			{#each weekData.hours as h}
				<div class="cal-time-label" style="grid-row:{h.row};grid-column:1">
					{formatHourLabel(h.hour)}
				</div>
				{#each { length: 7 } as _, c}
					<div
						class="cal-time-row cal-day-column"
						style="grid-row:{h.row};grid-column:{c + 2}"
						onclick={() => handleWeekSlotClick(c, h.hour)}
					></div>
				{/each}
			{/each}

			{#each weekData.eventBlocks as eb (eb.item.id + '-' + eb.column)}
				<div
					class="cal-event-block"
					style="grid-column:{eb.column};grid-row:1/{weekData.totalHours + 1};top:{eb.topPx}px;height:{eb.heightPx}px;background:{eb.color}22;border-left-color:{eb.color};color:{eb.color}"
					onclick={() => editEventById(eb.item.id)}
				>
					<div class="cal-event-block-title">{eb.item.title}</div>
					<div class="cal-event-block-time">{eb.timeLabel}</div>
				</div>
			{/each}

			{#if weekData.nowLine}
				<div
					class="cal-now-line"
					style="grid-column:{weekData.nowLine.column};grid-row:1/{weekData.totalHours + 1};top:{weekData.nowLine.topPx}px"
				></div>
			{/if}
		</div>

		<!-- ====== DAY VIEW ====== -->
	{:else}
		{#if dayData.allDayItems.length > 0}
			<div class="cal-allday-section" style="padding-left:60px">
				<span class="text-xs text-muted" style="margin-right:var(--space-sm)">all-day</span>
				{#each dayData.allDayItems as item (item.id)}
					{@const color = getCategoryColor($categories, item.categoryId)}
					<span
						class="cal-event-pill"
						style="background:{color}22;color:{color};display:inline-block"
						onclick={() => editEventById(item.id)}
					>
						{item.title}
					</span>
				{/each}
			</div>
		{/if}

		<div
			class="cal-time-grid"
			style="grid-template-columns:60px 1fr;grid-template-rows:repeat({dayData.totalHours},{DAY_ROW_HEIGHT}px)"
		>
			{#each dayData.hours as h}
				<div class="cal-time-label" style="grid-row:{h.row};grid-column:1">
					{formatHourLabel(h.hour)}
				</div>
				<div
					class="cal-time-row cal-day-column"
					style="grid-row:{h.row};grid-column:2"
					onclick={() => handleDaySlotClick(h.hour)}
				></div>
			{/each}

			{#each dayData.eventBlocks as eb (eb.item.id)}
				<div
					class="cal-event-block"
					style="grid-column:2;grid-row:1/{dayData.totalHours + 1};top:{eb.topPx}px;height:{eb.heightPx}px;background:{eb.color}22;border-left-color:{eb.color};color:{eb.color}"
					onclick={() => editEventById(eb.item.id)}
				>
					<div class="cal-event-block-title">{eb.item.title}</div>
					<div class="cal-event-block-time">{eb.timeLabel}</div>
					{#if eb.heightPx > 40 && eb.catLabel}
						<div class="cal-event-block-time">{eb.catLabel}</div>
					{/if}
				</div>
			{/each}

			{#if dayData.nowLine}
				<div
					class="cal-now-line"
					style="grid-column:2;grid-row:1/{dayData.totalHours + 1};top:{dayData.nowLine.topPx}px"
				></div>
			{/if}
		</div>
	{/if}
</div>

<!-- ====== EVENT MODAL ====== -->
{#if showEventModal}
	<div class="modal-overlay visible" role="dialog" onclick={(e) => { if (e.target === e.currentTarget) closeEventModal(); }}>
		<div class="modal">
			<div class="modal-header">
				<h2 class="modal-title">{editingEvent ? 'Edit Event' : 'Add Event'}</h2>
				<button class="modal-close" aria-label="Close" onclick={closeEventModal}
					>&times;</button
				>
			</div>
			<div class="modal-body">
				<form onsubmit={handleEventSubmit}>
					<div class="form-group">
						<label class="form-label">Title</label>
						<input type="text" bind:value={sfTitle} required />
					</div>
					<div class="form-group">
						<label class="form-label">Category</label>
						<select bind:value={sfCategory}>
							{#each $categories as cat (cat.id)}
								<option value={cat.id}>{cat.icon} {cat.name}</option>
							{/each}
						</select>
					</div>

					<!-- All-day toggle -->
					<div class="form-group">
						<label class="form-label">All Day / Multi-Day</label>
						<div class="flex gap-2 items-center">
							<label class="toggle">
								<input
									type="checkbox"
									bind:checked={sfAllDay}
									onchange={handleAllDayToggle}
								/>
								<span class="toggle-slider"></span>
							</label>
							<span class="text-sm text-secondary"
								>Spans full days (no specific times)</span
							>
						</div>
					</div>

					<!-- Recurring toggle -->
					{#if showRecurringGroup}
						<div class="form-group">
							<label class="form-label">Recurring?</label>
							<div class="flex gap-2 items-center">
								<label class="toggle">
									<input type="checkbox" bind:checked={sfRecurring} />
									<span class="toggle-slider"></span>
								</label>
								<span class="text-sm text-secondary">Repeat weekly</span>
							</div>
						</div>
					{/if}

					<!-- Recurring days -->
					{#if showDaysGroup}
						<div class="form-group">
							<label class="form-label">Days</label>
							<div>
								{#each dayNamesList as day}
									<label
										class="form-check"
										style="display:inline-flex;margin-right:var(--space-sm)"
									>
										<input
											type="checkbox"
											checked={sfDays.includes(day)}
											onchange={() => toggleDay(day)}
										/>
										{day}
									</label>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Single date -->
					{#if showDateGroup}
						<div class="form-group">
							<label class="form-label">Date</label>
							<input type="date" bind:value={sfDate} />
						</div>
					{/if}

					<!-- Multi-day date range -->
					{#if showAllDayDates}
						<div class="grid-2">
							<div class="form-group">
								<label class="form-label">Start Date</label>
								<input type="date" bind:value={sfStartDate} />
							</div>
							<div class="form-group">
								<label class="form-label">End Date</label>
								<input type="date" bind:value={sfEndDate} />
							</div>
						</div>
					{/if}

					<!-- Time dropdowns -->
					{#if showTimeGroup}
						<div class="grid-2">
							<div class="form-group">
								<label class="form-label">Start Time</label>
								<div class="flex gap-1">
									<select
										bind:value={sfStartHour}
										style="width:auto;min-width:55px"
									>
										{#each hourOptions as h}
											<option value={h}>{h}</option>
										{/each}
									</select>
									<span
										class="text-secondary"
										style="line-height:40px;font-weight:700">:</span
									>
									<select
										bind:value={sfStartMin}
										style="width:auto;min-width:60px"
									>
										{#each minuteOptions as m}
											<option value={m}>{padTime(m)}</option>
										{/each}
									</select>
									<select
										bind:value={sfStartAmpm}
										style="width:auto;min-width:60px"
									>
										<option value="AM">AM</option>
										<option value="PM">PM</option>
									</select>
								</div>
							</div>
							<div class="form-group">
								<label class="form-label">End Time</label>
								<div class="flex gap-1">
									<select bind:value={sfEndHour} style="width:auto;min-width:55px">
										{#each hourOptions as h}
											<option value={h}>{h}</option>
										{/each}
									</select>
									<span
										class="text-secondary"
										style="line-height:40px;font-weight:700">:</span
									>
									<select bind:value={sfEndMin} style="width:auto;min-width:60px">
										{#each minuteOptions as m}
											<option value={m}>{padTime(m)}</option>
										{/each}
									</select>
									<select
										bind:value={sfEndAmpm}
										style="width:auto;min-width:60px"
									>
										<option value="AM">AM</option>
										<option value="PM">PM</option>
									</select>
								</div>
							</div>
						</div>
					{/if}

					<div class="flex gap-1" style="justify-content:flex-end">
						{#if editingEvent}
							<button type="button" class="btn btn-danger" onclick={handleEventDelete}
								>Delete</button
							>
						{/if}
						<button type="button" class="btn" onclick={closeEventModal}>Cancel</button>
						<button type="submit" class="btn btn-primary"
							>{editingEvent ? 'Save' : 'Add Event'}</button
						>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}
