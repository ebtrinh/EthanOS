/**
 * EthanOS — Roadmap Visualizer
 */
(async function () {
  'use strict';

  await new Promise(function (resolve) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(resolve, 50);
    } else {
      document.addEventListener('DOMContentLoaded', function () { setTimeout(resolve, 50); });
    }
  });

  var roadmapEvents = await window.EthanOSData.loadData('roadmapEvents', []);
  var goals = await window.EthanOSData.loadData('goals', []);
  var tasks = await window.EthanOSData.loadData('tasks', []);
  var currentZoom = 'quarter';

  // ---- Zoom Buttons ----
  var zoomBtns = document.querySelectorAll('[data-zoom]');
  for (var i = 0; i < zoomBtns.length; i++) {
    zoomBtns[i].addEventListener('click', function () {
      currentZoom = this.getAttribute('data-zoom');
      for (var j = 0; j < zoomBtns.length; j++) {
        zoomBtns[j].classList.toggle('btn-primary', zoomBtns[j].getAttribute('data-zoom') === currentZoom);
      }
      renderTimeline();
    });
    if (zoomBtns[i].getAttribute('data-zoom') === currentZoom) {
      zoomBtns[i].classList.add('btn-primary');
    }
  }

  // ---- Add Event Button ----
  document.getElementById('add-event-btn').addEventListener('click', function () {
    openEventModal(null);
  });

  // ---- Build all timeline items ----
  function getAllItems() {
    var items = [];

    for (var i = 0; i < roadmapEvents.length; i++) {
      var e = roadmapEvents[i];
      items.push({
        id: e.id,
        title: e.title,
        date: e.date,
        categoryId: e.categoryId,
        type: e.type || 'event',
        source: 'event'
      });
    }

    for (var g = 0; g < goals.length; g++) {
      if (goals[g].targetDate) {
        items.push({
          id: 'goal_' + goals[g].id,
          title: goals[g].title,
          date: goals[g].targetDate,
          categoryId: goals[g].categoryId,
          type: 'goal',
          source: 'goal'
        });
      }
    }

    for (var t = 0; t < tasks.length; t++) {
      if (tasks[t].dueDate && !tasks[t].completed) {
        items.push({
          id: 'task_' + tasks[t].id,
          title: tasks[t].title,
          date: tasks[t].dueDate,
          categoryId: tasks[t].categoryId,
          type: 'deadline',
          source: 'task'
        });
      }
    }

    items.sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });

    return items;
  }

  // ---- Get date range based on zoom ----
  function getDateRange() {
    var now = new Date();
    var start = new Date(now);
    var end = new Date(now);

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

    return { start: start, end: end };
  }

  // ---- Type icon/colors ----
  function getTypeStyle(type) {
    switch (type) {
      case 'goal': return { icon: '🎯', border: 'var(--success)' };
      case 'deadline': return { icon: '⏰', border: 'var(--danger)' };
      case 'milestone': return { icon: '⭐', border: 'var(--warning)' };
      default: return { icon: '📌', border: 'var(--accent)' };
    }
  }

  // ---- Render Timeline ----
  function renderTimeline() {
    var container = document.getElementById('timeline-container');
    if (!container) return;

    var items = getAllItems();
    var range = getDateRange();
    var totalMs = range.end.getTime() - range.start.getTime();
    if (totalMs <= 0) totalMs = 1;

    var todayMs = new Date().getTime();
    var todayPct = ((todayMs - range.start.getTime()) / totalMs) * 100;
    todayPct = Math.max(0, Math.min(100, todayPct));

    // Filter items in range
    var visible = items.filter(function (it) {
      var d = new Date(it.date).getTime();
      return d >= range.start.getTime() && d <= range.end.getTime();
    });

    // Track lanes to avoid overlap
    var lanes = [];
    function findLane(pct) {
      for (var l = 0; l < lanes.length; l++) {
        var canFit = true;
        for (var p = 0; p < lanes[l].length; p++) {
          if (Math.abs(lanes[l][p] - pct) < 8) { canFit = false; break; }
        }
        if (canFit) { lanes[l].push(pct); return l; }
      }
      lanes.push([pct]);
      return lanes.length - 1;
    }

    // Month markers
    var monthMarkers = '';
    var monthDate = new Date(range.start);
    monthDate.setDate(1);
    while (monthDate <= range.end) {
      var mPct = ((monthDate.getTime() - range.start.getTime()) / totalMs) * 100;
      if (mPct >= 0 && mPct <= 100) {
        var monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: currentZoom === 'year' ? '2-digit' : undefined });
        monthMarkers += '<div style="position:absolute;left:' + mPct + '%;top:0;bottom:0;border-left:1px dashed var(--border-color);z-index:1">' +
          '<span class="text-xs text-muted" style="position:absolute;top:-18px;left:4px;white-space:nowrap">' + monthName + '</span>' +
        '</div>';
      }
      monthDate.setMonth(monthDate.getMonth() + 1);
    }

    // Today marker
    var todayMarker = '<div style="position:absolute;left:' + todayPct + '%;top:0;bottom:0;border-left:2px solid var(--danger);z-index:10">' +
      '<span class="text-xs" style="position:absolute;top:-18px;left:4px;color:var(--danger);font-weight:700;white-space:nowrap">Today</span>' +
    '</div>';

    // Event items
    var itemsHTML = '';
    for (var v = 0; v < visible.length; v++) {
      var it = visible[v];
      var itDate = new Date(it.date).getTime();
      var pct = ((itDate - range.start.getTime()) / totalMs) * 100;
      var lane = findLane(pct);
      var topOffset = 30 + lane * 56;
      var style = getTypeStyle(it.type);
      var catColor = getCategoryColor(it.categoryId);
      var isEvent = it.source === 'event';

      itemsHTML += '<div style="position:absolute;left:' + pct + '%;top:' + topOffset + 'px;transform:translateX(-50%);z-index:5;cursor:' + (isEvent ? 'pointer' : 'default') + '" ' +
        (isEvent ? 'data-event-id="' + it.id + '" class="timeline-event"' : '') + '>' +
        '<div style="background:var(--bg-card);border:1px solid ' + style.border + ';border-radius:var(--border-radius-sm);padding:6px 10px;white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis;font-size:var(--font-size-xs)">' +
          '<span>' + style.icon + '</span> ' +
          '<span style="color:' + catColor + '">' + it.title + '</span>' +
          '<div class="text-xs text-muted">' + formatDate(it.date) + '</div>' +
        '</div>' +
        '<div style="width:2px;height:8px;background:' + style.border + ';margin:0 auto"></div>' +
        '<div style="width:8px;height:8px;border-radius:50%;background:' + style.border + ';margin:0 auto"></div>' +
      '</div>';
    }

    var minHeight = 30 + (lanes.length + 1) * 56;
    container.style.minHeight = minHeight + 'px';

    // Axis line
    var axisTop = 24;
    var axisHTML = '<div style="position:absolute;left:0;right:0;top:' + axisTop + 'px;height:2px;background:var(--border-color);z-index:0"></div>';

    container.innerHTML = axisHTML + monthMarkers + todayMarker + itemsHTML;

    if (visible.length === 0 && items.length === 0) {
      container.innerHTML += '<div class="empty-state"><div class="empty-state-icon">🗺️</div><div class="empty-state-title">No events on your roadmap</div><div class="empty-state-text">Add events, or create goals/tasks with dates to see them here.</div></div>';
    }

    // Click handlers for events
    var eventEls = container.querySelectorAll('.timeline-event');
    for (var e = 0; e < eventEls.length; e++) {
      eventEls[e].addEventListener('click', function () {
        var evId = this.getAttribute('data-event-id');
        var ev = null;
        for (var r = 0; r < roadmapEvents.length; r++) {
          if (roadmapEvents[r].id === evId) { ev = roadmapEvents[r]; break; }
        }
        if (ev) openEventModal(ev);
      });
    }
  }

  // ---- Event Modal ----
  function openEventModal(ev) {
    var isEdit = !!ev;
    var title = isEdit ? 'Edit Event' : 'Add Event';
    var cats = getAllCategories();

    var catOptions = '<option value="">-- None --</option>';
    for (var c = 0; c < cats.length; c++) {
      var sel = (ev && ev.categoryId === cats[c].id) ? ' selected' : '';
      catOptions += '<option value="' + cats[c].id + '"' + sel + '>' + cats[c].icon + ' ' + cats[c].name + '</option>';
    }

    var typeOptions = ['event', 'milestone', 'deadline'].map(function (t) {
      var sel = (ev && ev.type === t) ? ' selected' : '';
      return '<option value="' + t + '"' + sel + '>' + t.charAt(0).toUpperCase() + t.slice(1) + '</option>';
    }).join('');

    var html =
      '<div class="form-group"><label class="form-label">Title</label><input type="text" id="ev-title" value="' + (ev ? ev.title : '') + '"></div>' +
      '<div class="form-group"><label class="form-label">Date</label><input type="date" id="ev-date" value="' + (ev ? ev.date : new Date().toISOString().slice(0, 10)) + '"></div>' +
      '<div class="form-group"><label class="form-label">Category</label><select id="ev-cat">' + catOptions + '</select></div>' +
      '<div class="form-group"><label class="form-label">Type</label><select id="ev-type">' + typeOptions + '</select></div>' +
      '<div class="modal-footer" style="border:none;padding:0;margin-top:var(--space-lg)">' +
        (isEdit ? '<button class="btn btn-danger btn-sm" id="ev-delete-btn">Delete</button>' : '<span></span>') +
        '<button class="btn btn-primary" id="ev-save-btn">' + (isEdit ? 'Update' : 'Add Event') + '</button>' +
      '</div>';

    openModal(title, html);

    document.getElementById('ev-save-btn').addEventListener('click', async function () {
      var titleVal = document.getElementById('ev-title').value.trim();
      if (!titleVal) { showToast('Title is required', 'warning'); return; }

      var dateVal = document.getElementById('ev-date').value;
      var catVal = document.getElementById('ev-cat').value;
      var typeVal = document.getElementById('ev-type').value;

      if (isEdit) {
        ev.title = titleVal;
        ev.date = dateVal;
        ev.categoryId = catVal;
        ev.type = typeVal;
      } else {
        roadmapEvents.push({
          id: generateId(),
          title: titleVal,
          date: dateVal,
          categoryId: catVal,
          type: typeVal
        });
      }

      await window.EthanOSData.saveData('roadmapEvents', roadmapEvents);
      showToast(isEdit ? 'Event updated' : 'Event added', 'success');
      closeModal();
      renderTimeline();
    });

    if (isEdit) {
      document.getElementById('ev-delete-btn').addEventListener('click', async function () {
        roadmapEvents = roadmapEvents.filter(function (r) { return r.id !== ev.id; });
        await window.EthanOSData.saveData('roadmapEvents', roadmapEvents);
        showToast('Event deleted', 'info');
        closeModal();
        renderTimeline();
      });
    }
  }

  renderTimeline();
})();
