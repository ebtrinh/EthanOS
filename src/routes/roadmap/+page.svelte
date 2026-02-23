<script>
  import { categories, goals, roadmapEvents, tasks, saveStore } from '$lib/stores/data.js';
  import { generateId, formatDate, getCategoryById, getCategoryColor, COLOR_MAP, BADGE_CLASS_MAP } from '$lib/helpers.js';
  import { showToast } from '$lib/stores/toast.js';
  import { openModal, closeModal } from '$lib/stores/modal.js';

  let currentZoom = $state('quarter');

  // --- Type icon/colors ---
  function getTypeStyle(type) {
    switch (type) {
      case 'goal': return { icon: '&#127919;', border: 'var(--success)' };
      case 'deadline': return { icon: '&#9200;', border: 'var(--danger)' };
      case 'milestone': return { icon: '&#11088;', border: 'var(--warning)' };
      default: return { icon: '&#128204;', border: 'var(--accent)' };
    }
  }

  // --- Build all timeline items ---
  let allItems = $derived.by(() => {
    const items = [];

    for (const e of $roadmapEvents) {
      items.push({
        id: e.id,
        title: e.title,
        date: e.date,
        categoryId: e.categoryId,
        type: e.type || 'event',
        source: 'event'
      });
    }

    for (const g of $goals) {
      if (g.targetDate) {
        items.push({
          id: 'goal_' + g.id,
          title: g.title,
          date: g.targetDate,
          categoryId: g.categoryId,
          type: 'goal',
          source: 'goal'
        });
      }
    }

    for (const t of $tasks) {
      if (t.dueDate && !t.completed) {
        items.push({
          id: 'task_' + t.id,
          title: t.title,
          date: t.dueDate,
          categoryId: t.categoryId,
          type: 'deadline',
          source: 'task'
        });
      }
    }

    items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return items;
  });

  // --- Date range based on zoom ---
  let dateRange = $derived.by(() => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    if (currentZoom === 'month') {
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
    } else if (currentZoom === 'quarter') {
      start.setMonth(start.getMonth() - 1);
      start.setDate(1);
      end.setMonth(end.getMonth() + 3);
      end.setDate(0);
    } else {
      start.setMonth(0);
      start.setDate(1);
      end.setMonth(11);
      end.setDate(31);
    }

    return { start, end };
  });

  // --- Filter visible items in range ---
  let visibleItems = $derived.by(() => {
    const { start, end } = dateRange;
    return allItems.filter(it => {
      const d = new Date(it.date).getTime();
      return d >= start.getTime() && d <= end.getTime();
    });
  });

  // --- Timeline layout computation ---
  let timelineData = $derived.by(() => {
    const { start, end } = dateRange;
    const totalMs = end.getTime() - start.getTime() || 1;

    // Today marker
    const todayMs = new Date().getTime();
    const todayPct = Math.max(0, Math.min(100, ((todayMs - start.getTime()) / totalMs) * 100));

    // Month markers
    const months = [];
    const monthDate = new Date(start);
    monthDate.setDate(1);
    while (monthDate <= end) {
      const mPct = ((monthDate.getTime() - start.getTime()) / totalMs) * 100;
      if (mPct >= 0 && mPct <= 100) {
        const label = monthDate.toLocaleDateString('en-US', {
          month: 'short',
          year: currentZoom === 'year' ? '2-digit' : undefined
        });
        months.push({ pct: mPct, label });
      }
      monthDate.setMonth(monthDate.getMonth() + 1);
    }

    // Lane allocation to avoid overlap
    const lanes = [];
    function findLane(pct) {
      for (let l = 0; l < lanes.length; l++) {
        let canFit = true;
        for (const p of lanes[l]) {
          if (Math.abs(p - pct) < 8) { canFit = false; break; }
        }
        if (canFit) { lanes[l].push(pct); return l; }
      }
      lanes.push([pct]);
      return lanes.length - 1;
    }

    const positioned = visibleItems.map(it => {
      const itDate = new Date(it.date).getTime();
      const pct = ((itDate - start.getTime()) / totalMs) * 100;
      const lane = findLane(pct);
      return { ...it, pct, lane, topOffset: 30 + lane * 56 };
    });

    const minHeight = 30 + (lanes.length + 1) * 56;

    return { todayPct, months, positioned, minHeight };
  });

  // --- Click event to edit ---
  function handleEventClick(item) {
    if (item.source !== 'event') return;
    const ev = $roadmapEvents.find(r => r.id === item.id);
    if (ev) openEventModal(ev);
  }

  // --- Event Modal ---
  function openEventModal(ev) {
    const isEdit = !!ev;
    const title = isEdit ? 'Edit Event' : 'Add Event';
    const cats = $categories;

    let catOptions = '<option value="">-- None --</option>';
    for (const cat of cats) {
      const sel = (ev && ev.categoryId === cat.id) ? ' selected' : '';
      catOptions += `<option value="${cat.id}"${sel}>${cat.icon} ${cat.name}</option>`;
    }

    const typeOptions = ['event', 'milestone', 'deadline'].map(t => {
      const sel = (ev && ev.type === t) ? ' selected' : '';
      return `<option value="${t}"${sel}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`;
    }).join('');

    const html =
      `<div class="form-group"><label class="form-label">Title</label><input type="text" id="ev-title" value="${ev ? ev.title.replace(/"/g, '&quot;') : ''}"></div>` +
      `<div class="form-group"><label class="form-label">Date</label><input type="date" id="ev-date" value="${ev ? ev.date : new Date().toISOString().slice(0, 10)}"></div>` +
      `<div class="form-group"><label class="form-label">Category</label><select id="ev-cat">${catOptions}</select></div>` +
      `<div class="form-group"><label class="form-label">Type</label><select id="ev-type">${typeOptions}</select></div>` +
      `<div class="modal-footer" style="border:none;padding:0;margin-top:var(--space-lg)">` +
        (isEdit ? `<button class="btn btn-danger btn-sm" id="ev-delete-btn">Delete</button>` : '<span></span>') +
        `<button class="btn btn-primary" id="ev-save-btn">${isEdit ? 'Update' : 'Add Event'}</button>` +
      `</div>`;

    openModal(title, html);

    requestAnimationFrame(() => {
      const saveBtn = document.getElementById('ev-save-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          const titleVal = document.getElementById('ev-title').value.trim();
          if (!titleVal) { showToast('Title is required', 'warning'); return; }

          const dateVal = document.getElementById('ev-date').value;
          const catVal = document.getElementById('ev-cat').value;
          const typeVal = document.getElementById('ev-type').value;

          if (isEdit) {
            $roadmapEvents = $roadmapEvents.map(r => {
              if (r.id !== ev.id) return r;
              return { ...r, title: titleVal, date: dateVal, categoryId: catVal, type: typeVal };
            });
          } else {
            $roadmapEvents = [...$roadmapEvents, {
              id: generateId(),
              title: titleVal,
              date: dateVal,
              categoryId: catVal,
              type: typeVal
            }];
          }

          saveStore('roadmapEvents', $roadmapEvents);
          showToast(isEdit ? 'Event updated' : 'Event added', 'success');
          closeModal();
        });
      }

      if (isEdit) {
        const deleteBtn = document.getElementById('ev-delete-btn');
        if (deleteBtn) {
          deleteBtn.addEventListener('click', () => {
            $roadmapEvents = $roadmapEvents.filter(r => r.id !== ev.id);
            saveStore('roadmapEvents', $roadmapEvents);
            showToast('Event deleted', 'info');
            closeModal();
          });
        }
      }
    });
  }
</script>

<div class="page-header flex-between">
  <div>
    <h1 class="page-title">Roadmap</h1>
    <p class="page-subtitle">Visualize your timeline of events, goals, and deadlines</p>
  </div>
  <button class="btn btn-primary" onclick={() => openEventModal(null)}>+ Add Event</button>
</div>

<!-- Zoom Controls -->
<div class="flex items-center gap-2 mb-3">
  <span class="text-sm text-secondary">Zoom:</span>
  <div class="btn-group">
    <button
      class="btn btn-sm{currentZoom === 'year' ? ' btn-primary' : ''}"
      onclick={() => currentZoom = 'year'}
    >Year</button>
    <button
      class="btn btn-sm{currentZoom === 'quarter' ? ' btn-primary' : ''}"
      onclick={() => currentZoom = 'quarter'}
    >Quarter</button>
    <button
      class="btn btn-sm{currentZoom === 'month' ? ' btn-primary' : ''}"
      onclick={() => currentZoom = 'month'}
    >Month</button>
  </div>
</div>

<!-- Timeline -->
<div class="card" style="overflow-x:auto;padding:var(--space-md)">
  <div id="timeline-container" style="position:relative;min-height:{timelineData.minHeight}px">
    <!-- Axis line -->
    <div style="position:absolute;left:0;right:0;top:24px;height:2px;background:var(--border-color);z-index:0"></div>

    <!-- Month markers -->
    {#each timelineData.months as month}
      <div style="position:absolute;left:{month.pct}%;top:0;bottom:0;border-left:1px dashed var(--border-color);z-index:1">
        <span class="text-xs text-muted" style="position:absolute;top:-18px;left:4px;white-space:nowrap">{month.label}</span>
      </div>
    {/each}

    <!-- Today marker -->
    <div style="position:absolute;left:{timelineData.todayPct}%;top:0;bottom:0;border-left:2px solid var(--danger);z-index:10">
      <span class="text-xs" style="position:absolute;top:-18px;left:4px;color:var(--danger);font-weight:700;white-space:nowrap">Today</span>
    </div>

    <!-- Event items -->
    {#each timelineData.positioned as it (it.id)}
      {@const style = getTypeStyle(it.type)}
      {@const catColor = getCategoryColor($categories, it.categoryId)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        style="position:absolute;left:{it.pct}%;top:{it.topOffset}px;transform:translateX(-50%);z-index:5;cursor:{it.source === 'event' ? 'pointer' : 'default'}"
        onclick={() => handleEventClick(it)}
      >
        <div style="background:var(--bg-card);border:1px solid {style.border};border-radius:var(--border-radius-sm);padding:6px 10px;white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis;font-size:var(--font-size-xs)">
          <span>{@html style.icon}</span>
          <span style:color={catColor}>{it.title}</span>
          <div class="text-xs text-muted">{formatDate(it.date)}</div>
        </div>
        <div style="width:2px;height:8px;background:{style.border};margin:0 auto"></div>
        <div style="width:8px;height:8px;border-radius:50%;background:{style.border};margin:0 auto"></div>
      </div>
    {/each}

    {#if visibleItems.length === 0 && allItems.length === 0}
      <div class="empty-state">
        <div class="empty-state-icon">&#128506;</div>
        <div class="empty-state-title">No events on your roadmap</div>
        <div class="empty-state-text">Add events, or create goals/tasks with dates to see them here.</div>
      </div>
    {/if}
  </div>
</div>
