/**
 * EthanOS — Schedule Intelligence (schedule.html)
 *
 * Day view: 6am-11pm vertical timeline with color-coded blocks.
 * Week view toggle. Free time + longest uninterrupted block stats.
 * Add/Edit/Delete schedule items via modal. Show task deadlines.
 */

(function () {
  'use strict';

  var schedule = [];
  var tasks = [];
  var categories = [];
  var viewMode = 'day'; // 'day' or 'week'
  var weekOffset = 0;

  /* ======================================================================
     BOOT
     ====================================================================== */
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(async function () {
      await loadData();
      bindEvents();
      render();
    }, 400);
  });

  async function loadData() {
    schedule = await window.EthanOSData.loadData('schedule', []);
    tasks = await window.EthanOSData.loadData('tasks', []);
    categories = getAllCategories();
  }

  /* ======================================================================
     EVENTS
     ====================================================================== */
  function bindEvents() {
    document.getElementById('view-day-btn').addEventListener('click', function () {
      viewMode = 'day';
      updateViewButtons();
      render();
    });
    document.getElementById('view-week-btn').addEventListener('click', function () {
      viewMode = 'week';
      updateViewButtons();
      render();
    });
    document.getElementById('add-schedule-btn').addEventListener('click', function () {
      openScheduleModal(null);
    });
    document.getElementById('week-prev').addEventListener('click', function () {
      weekOffset--;
      render();
    });
    document.getElementById('week-next').addEventListener('click', function () {
      weekOffset++;
      render();
    });
  }

  function updateViewButtons() {
    var dayBtn = document.getElementById('view-day-btn');
    var weekBtn = document.getElementById('view-week-btn');
    dayBtn.className = viewMode === 'day' ? 'btn btn-primary' : 'btn';
    weekBtn.className = viewMode === 'week' ? 'btn btn-primary' : 'btn';
    document.getElementById('day-view').classList.toggle('hidden', viewMode !== 'day');
    document.getElementById('week-view').classList.toggle('hidden', viewMode !== 'week');
  }

  /* ======================================================================
     RENDER
     ====================================================================== */
  function render() {
    updateViewButtons();
    renderStats();
    if (viewMode === 'day') renderDayView();
    else renderWeekView();
  }

  /* ======================================================================
     STATS
     ====================================================================== */
  function renderStats() {
    var today = new Date();
    var todayItems = getItemsForDate(today);
    var totalDayMinutes = 17 * 60; // 6am-11pm

    var scheduledMinutes = 0;
    var blocks = []; // {start, end} in minutes from 6am

    for (var i = 0; i < todayItems.length; i++) {
      var item = todayItems[i];
      var times = getItemTimes(item, today);
      if (!times) continue;
      var startMin = (times.start.getHours() - 6) * 60 + times.start.getMinutes();
      var endMin = (times.end.getHours() - 6) * 60 + times.end.getMinutes();
      if (startMin < 0) startMin = 0;
      if (endMin > totalDayMinutes) endMin = totalDayMinutes;
      var dur = endMin - startMin;
      if (dur > 0) {
        scheduledMinutes += dur;
        blocks.push({ start: startMin, end: endMin });
      }
    }

    var freeMinutes = Math.max(0, totalDayMinutes - scheduledMinutes);
    var freeH = Math.floor(freeMinutes / 60);
    var freeM = freeMinutes % 60;

    // Longest uninterrupted free block
    blocks.sort(function (a, b) { return a.start - b.start; });
    var longestFree = 0;
    var lastEnd = 0;
    for (var j = 0; j < blocks.length; j++) {
      var gap = blocks[j].start - lastEnd;
      if (gap > longestFree) longestFree = gap;
      if (blocks[j].end > lastEnd) lastEnd = blocks[j].end;
    }
    var trailingGap = totalDayMinutes - lastEnd;
    if (trailingGap > longestFree) longestFree = trailingGap;

    var lfH = Math.floor(longestFree / 60);
    var lfM = longestFree % 60;

    var schH = Math.floor(scheduledMinutes / 60);
    var schM = scheduledMinutes % 60;

    document.getElementById('free-time-stat').textContent = freeH + 'h ' + freeM + 'm';
    document.getElementById('longest-block-stat').textContent = lfH + 'h ' + lfM + 'm';
    document.getElementById('scheduled-hours-stat').textContent = schH + 'h ' + schM + 'm';
  }

  /* ======================================================================
     DAY VIEW
     ====================================================================== */
  function renderDayView() {
    var today = new Date();
    document.getElementById('day-view-title').textContent = 'Today — ' + formatDate(today);

    var timeline = document.getElementById('day-timeline');
    var todayItems = getItemsForDate(today);
    var todayTasks = getTaskDeadlinesForDate(today);

    // Build 17-hour timeline (6am to 11pm)
    var html = '<div style="position:relative">';

    // Hour labels
    for (var h = 6; h <= 23; h++) {
      var top = ((h - 6) / 17) * 100;
      var label = h > 12 ? (h - 12) + ' PM' : (h === 12 ? '12 PM' : h + ' AM');
      html += '<div style="position:absolute;top:' + top + '%;left:0;width:100%;border-top:1px solid var(--border-subtle);height:0">' +
        '<span class="text-xs text-muted" style="position:absolute;left:0;top:-8px">' + label + '</span>' +
      '</div>';
    }

    // Schedule blocks
    for (var i = 0; i < todayItems.length; i++) {
      var item = todayItems[i];
      var times = getItemTimes(item, today);
      if (!times) continue;

      var startPct = ((times.start.getHours() + times.start.getMinutes() / 60 - 6) / 17) * 100;
      var endPct = ((times.end.getHours() + times.end.getMinutes() / 60 - 6) / 17) * 100;
      var heightPct = endPct - startPct;
      if (heightPct < 1) heightPct = 1;
      var color = getCategoryColor(item.categoryId);

      html += '<div style="position:absolute;top:' + startPct + '%;left:50px;right:0;height:' + heightPct + '%;' +
        'background:' + color + '22;border-left:3px solid ' + color + ';border-radius:var(--border-radius-sm);' +
        'padding:4px 8px;overflow:hidden;cursor:pointer;min-height:24px" ' +
        'onclick="window._schEdit(\'' + item.id + '\')">' +
        '<div class="text-sm font-bold" style="color:' + color + '">' + escapeHtml(item.title) + '</div>' +
        '<div class="text-xs text-muted">' + formatTime(times.start) + ' - ' + formatTime(times.end) + '</div>' +
      '</div>';
    }

    // Task deadline markers
    for (var j = 0; j < todayTasks.length; j++) {
      var t = todayTasks[j];
      var due = new Date(t.dueDate);
      var duePct = ((due.getHours() + due.getMinutes() / 60 - 6) / 17) * 100;
      if (duePct < 0) duePct = 0;
      if (duePct > 100) duePct = 100;

      html += '<div style="position:absolute;top:' + duePct + '%;left:50px;right:0;height:0;border-top:2px dashed var(--danger);z-index:2">' +
        '<span class="text-xs badge badge-danger" style="position:absolute;right:0;top:-10px">' + escapeHtml(t.title) + ' due</span>' +
      '</div>';
    }

    html += '</div>';
    timeline.innerHTML = html;
    timeline.style.minHeight = '680px';
  }

  /* ======================================================================
     WEEK VIEW
     ====================================================================== */
  function renderWeekView() {
    var baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + weekOffset * 7);

    // Get Monday of the week
    var day = baseDate.getDay();
    var monday = new Date(baseDate);
    monday.setDate(monday.getDate() - ((day + 6) % 7));

    var weekTitle = formatDate(monday) + ' - ';
    var sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    weekTitle += formatDate(sunday);
    document.getElementById('week-view-title').textContent = weekTitle;

    var dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:var(--space-sm);min-height:400px">';

    for (var d = 0; d < 7; d++) {
      var date = new Date(monday);
      date.setDate(date.getDate() + d);
      var isToday = date.toDateString() === new Date().toDateString();

      var items = getItemsForDate(date);

      html += '<div style="background:var(--bg-primary);border-radius:var(--border-radius-md);padding:var(--space-sm);' +
        (isToday ? 'border:1px solid var(--accent)' : 'border:1px solid var(--border-subtle)') + '">' +
        '<div class="text-sm font-bold text-center mb-1' + (isToday ? ' text-accent' : '') + '">' +
          dayNames[d] + '<br>' + date.getDate() +
        '</div>';

      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var color = getCategoryColor(item.categoryId);
        var times = getItemTimes(item, date);
        var timeStr = times ? formatTime(times.start) : '';

        html += '<div style="background:' + color + '22;border-left:2px solid ' + color + ';' +
          'border-radius:3px;padding:2px 4px;margin-bottom:2px;font-size:var(--font-size-xs);cursor:pointer" ' +
          'onclick="window._schEdit(\'' + item.id + '\')">' +
          '<div style="color:' + color + '">' + escapeHtml(item.title) + '</div>' +
          '<div class="text-muted">' + timeStr + '</div>' +
        '</div>';
      }

      html += '</div>';
    }

    html += '</div>';
    document.getElementById('week-grid').innerHTML = html;
  }

  /* ======================================================================
     SCHEDULE MODAL
     ====================================================================== */
  function openScheduleModal(item) {
    var isEdit = !!item;
    var cats = getAllCategories();

    var catOptions = '';
    for (var i = 0; i < cats.length; i++) {
      var sel = (item && item.categoryId === cats[i].id) ? ' selected' : '';
      catOptions += '<option value="' + cats[i].id + '"' + sel + '>' + cats[i].icon + ' ' + cats[i].name + '</option>';
    }

    var dayCheckboxes = '';
    var dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (var d = 0; d < dayNames.length; d++) {
      var checked = (item && item.days && item.days.indexOf(dayNames[d]) !== -1) ? ' checked' : '';
      dayCheckboxes += '<label class="form-check" style="display:inline-flex;margin-right:var(--space-sm)">' +
        '<input type="checkbox" class="sch-day-cb" value="' + dayNames[d] + '"' + checked + '> ' + dayNames[d] +
      '</label>';
    }

    // Parse existing times
    var startDate = '', startTime = '', endTime = '';
    if (item && item.startTime) {
      var st = new Date(item.startTime);
      startDate = st.toISOString().split('T')[0];
      startTime = padTime(st.getHours()) + ':' + padTime(st.getMinutes());
    }
    if (item && item.endTime) {
      var et = new Date(item.endTime);
      endTime = padTime(et.getHours()) + ':' + padTime(et.getMinutes());
    }

    var html = '<form id="sch-form">' +
      '<div class="form-group">' +
        '<label class="form-label">Title</label>' +
        '<input type="text" id="sf-title" value="' + escapeAttr(item ? item.title : '') + '" required>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Category</label>' +
        '<select id="sf-category">' + catOptions + '</select>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Recurring?</label>' +
        '<div class="flex gap-2 items-center">' +
          '<label class="toggle"><input type="checkbox" id="sf-recurring"' + (item && item.recurring ? ' checked' : '') + '>' +
            '<span class="toggle-slider"></span></label>' +
          '<span class="text-sm text-secondary">Repeat weekly</span>' +
        '</div>' +
      '</div>' +
      '<div class="form-group" id="sf-days-group"' + (item && item.recurring ? '' : ' style="display:none"') + '>' +
        '<label class="form-label">Days</label>' +
        '<div>' + dayCheckboxes + '</div>' +
      '</div>' +
      '<div class="form-group" id="sf-date-group"' + (item && item.recurring ? ' style="display:none"' : '') + '>' +
        '<label class="form-label">Date</label>' +
        '<input type="date" id="sf-date" value="' + startDate + '">' +
      '</div>' +
      '<div class="grid-2">' +
        '<div class="form-group">' +
          '<label class="form-label">Start Time</label>' +
          '<input type="time" id="sf-start" value="' + startTime + '" required>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">End Time</label>' +
          '<input type="time" id="sf-end" value="' + endTime + '" required>' +
        '</div>' +
      '</div>' +
      '<div class="flex gap-1" style="justify-content:flex-end">' +
        (isEdit ? '<button type="button" class="btn btn-danger" id="sf-delete">Delete</button>' : '') +
        '<button type="button" class="btn" onclick="closeModal()">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">' + (isEdit ? 'Save' : 'Add Block') + '</button>' +
      '</div>' +
    '</form>';

    openModal(isEdit ? 'Edit Schedule Block' : 'Add Schedule Block', html);

    // Toggle recurring fields
    document.getElementById('sf-recurring').addEventListener('change', function () {
      document.getElementById('sf-days-group').style.display = this.checked ? '' : 'none';
      document.getElementById('sf-date-group').style.display = this.checked ? 'none' : '';
    });

    // Delete
    if (isEdit) {
      document.getElementById('sf-delete').addEventListener('click', async function () {
        schedule = schedule.filter(function (s) { return s.id !== item.id; });
        await window.EthanOSData.saveData('schedule', schedule);
        closeModal();
        showToast('Schedule block deleted', 'warning');
        render();
      });
    }

    // Submit
    document.getElementById('sch-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var title = document.getElementById('sf-title').value.trim();
      if (!title) return;

      var recurring = document.getElementById('sf-recurring').checked;
      var categoryId = document.getElementById('sf-category').value;
      var startTimeVal = document.getElementById('sf-start').value;
      var endTimeVal = document.getElementById('sf-end').value;
      var dateVal = document.getElementById('sf-date').value || new Date().toISOString().split('T')[0];

      var days = [];
      if (recurring) {
        var cbs = document.querySelectorAll('.sch-day-cb:checked');
        for (var c = 0; c < cbs.length; c++) days.push(cbs[c].value);
      }

      var startISO = dateVal + 'T' + startTimeVal + ':00';
      var endISO = dateVal + 'T' + endTimeVal + ':00';

      if (isEdit) {
        item.title = title;
        item.categoryId = categoryId;
        item.recurring = recurring;
        item.days = days;
        item.startTime = startISO;
        item.endTime = endISO;
      } else {
        schedule.push({
          id: generateId(),
          title: title,
          categoryId: categoryId,
          startTime: startISO,
          endTime: endISO,
          recurring: recurring,
          days: days
        });
      }

      await window.EthanOSData.saveData('schedule', schedule);
      closeModal();
      showToast(isEdit ? 'Schedule updated' : 'Schedule block added', 'success');
      render();
    });
  }

  window._schEdit = function (id) {
    for (var i = 0; i < schedule.length; i++) {
      if (schedule[i].id === id) {
        openScheduleModal(schedule[i]);
        return;
      }
    }
  };

  /* ======================================================================
     HELPERS
     ====================================================================== */
  function getItemsForDate(date) {
    var dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
    var dateStr = date.toISOString().split('T')[0];
    var result = [];

    for (var i = 0; i < schedule.length; i++) {
      var item = schedule[i];
      if (item.recurring && item.days && item.days.indexOf(dayName) !== -1) {
        result.push(item);
      } else if (item.startTime && item.startTime.indexOf(dateStr) === 0) {
        result.push(item);
      }
    }
    return result;
  }

  function getItemTimes(item, date) {
    if (!item.startTime || !item.endTime) return null;

    if (item.recurring) {
      // Use the time portion from the stored times
      var sTime = item.startTime.split('T')[1] || '00:00:00';
      var eTime = item.endTime.split('T')[1] || '00:00:00';
      var sParts = sTime.split(':');
      var eParts = eTime.split(':');

      var start = new Date(date);
      start.setHours(parseInt(sParts[0]) || 0, parseInt(sParts[1]) || 0, 0, 0);
      var end = new Date(date);
      end.setHours(parseInt(eParts[0]) || 0, parseInt(eParts[1]) || 0, 0, 0);
      return { start: start, end: end };
    }

    return { start: new Date(item.startTime), end: new Date(item.endTime) };
  }

  function getTaskDeadlinesForDate(date) {
    var dateStr = date.toISOString().split('T')[0];
    return tasks.filter(function (t) {
      return !t.completed && t.dueDate && t.dueDate.indexOf(dateStr) === 0;
    });
  }

  function padTime(n) { return n < 10 ? '0' + n : '' + n; }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

})();
