/**
 * EthanOS — Schedule Calendar (schedule.html)
 *
 * Full Google Calendar-style calendar with Month, Week, and Day views.
 * Navigation, add/edit/delete events via modal, category-colored events.
 */

(function () {
  'use strict';

  /* ======================================================================
     STATE
     ====================================================================== */
  var viewMode = 'month'; // 'month', 'week', 'day'
  var currentDate = new Date();
  var schedule = [];
  var categories = [];

  /* ======================================================================
     HELPERS
     ====================================================================== */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function padTime(n) { return n < 10 ? '0' + n : '' + n; }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
  }

  function isToday(d) {
    return sameDay(d, new Date());
  }

  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];
  var MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  function getItemsForDate(date) {
    var dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
    var dateStr = date.getFullYear() + '-' + padTime(date.getMonth() + 1) + '-' + padTime(date.getDate());
    var result = [];

    for (var i = 0; i < schedule.length; i++) {
      var item = schedule[i];
      if (item.recurring && item.days && item.days.indexOf(dayName) !== -1) {
        result.push(item);
      } else if (item.startTime && item.startTime.indexOf(dateStr) === 0) {
        result.push(item);
      }
    }

    // Sort by start time
    result.sort(function (a, b) {
      var aTime = a.startTime ? a.startTime.split('T')[1] || '00:00' : '00:00';
      var bTime = b.startTime ? b.startTime.split('T')[1] || '00:00' : '00:00';
      return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
    });

    return result;
  }

  function getItemTimes(item, date) {
    if (!item.startTime || !item.endTime) return null;

    if (item.recurring) {
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

  function getMondayOfWeek(d) {
    var date = new Date(d);
    var day = date.getDay();
    var diff = (day === 0 ? -6 : 1) - day;
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function formatHourLabel(h) {
    if (h === 0) return '12 AM';
    if (h < 12) return h + ' AM';
    if (h === 12) return '12 PM';
    return (h - 12) + ' PM';
  }

  /* ======================================================================
     BOOT
     ====================================================================== */
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(async function () {
      schedule = await window.EthanOSData.loadData('schedule', []);
      categories = getAllCategories();
      bindEvents();
      render();
    }, 400);
  });

  /* ======================================================================
     EVENTS
     ====================================================================== */
  function bindEvents() {
    document.getElementById('cal-prev').addEventListener('click', function () {
      navigate(-1);
    });
    document.getElementById('cal-next').addEventListener('click', function () {
      navigate(1);
    });
    document.getElementById('cal-today').addEventListener('click', function () {
      currentDate = new Date();
      render();
    });
    document.getElementById('cal-month-btn').addEventListener('click', function () {
      viewMode = 'month';
      render();
    });
    document.getElementById('cal-week-btn').addEventListener('click', function () {
      viewMode = 'week';
      render();
    });
    document.getElementById('cal-day-btn').addEventListener('click', function () {
      viewMode = 'day';
      render();
    });
    document.getElementById('cal-add-btn').addEventListener('click', function () {
      openScheduleModal(null, null);
    });
  }

  function navigate(dir) {
    if (viewMode === 'month') {
      currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1);
    } else if (viewMode === 'week') {
      currentDate = new Date(currentDate.getTime() + dir * 7 * 86400000);
    } else {
      currentDate = new Date(currentDate.getTime() + dir * 86400000);
    }
    render();
  }

  /* ======================================================================
     RENDER
     ====================================================================== */
  function render() {
    updateViewButtons();
    updateSubtitle();
    if (viewMode === 'month') renderMonth();
    else if (viewMode === 'week') renderWeek();
    else renderDay();
  }

  function updateViewButtons() {
    var monthBtn = document.getElementById('cal-month-btn');
    var weekBtn = document.getElementById('cal-week-btn');
    var dayBtn = document.getElementById('cal-day-btn');

    monthBtn.className = viewMode === 'month' ? 'btn btn-primary btn-sm' : 'btn btn-sm';
    weekBtn.className = viewMode === 'week' ? 'btn btn-primary btn-sm' : 'btn btn-sm';
    dayBtn.className = viewMode === 'day' ? 'btn btn-primary btn-sm' : 'btn btn-sm';
  }

  function updateSubtitle() {
    var el = document.getElementById('cal-subtitle');
    if (viewMode === 'month') {
      el.textContent = MONTH_NAMES[currentDate.getMonth()] + ' ' + currentDate.getFullYear();
    } else if (viewMode === 'week') {
      var mon = getMondayOfWeek(currentDate);
      var sun = new Date(mon);
      sun.setDate(sun.getDate() + 6);
      el.textContent = MONTH_SHORT[mon.getMonth()] + ' ' + mon.getDate() +
        ' - ' + MONTH_SHORT[sun.getMonth()] + ' ' + sun.getDate() + ', ' + sun.getFullYear();
    } else {
      var dayIdx = currentDate.getDay();
      var fullDayIdx = dayIdx === 0 ? 6 : dayIdx - 1;
      el.textContent = DAY_FULL[fullDayIdx] + ', ' + MONTH_NAMES[currentDate.getMonth()] + ' ' +
        currentDate.getDate() + ', ' + currentDate.getFullYear();
    }
  }

  /* ======================================================================
     MONTH VIEW
     ====================================================================== */
  function renderMonth() {
    var container = document.getElementById('cal-container');
    var year = currentDate.getFullYear();
    var month = currentDate.getMonth();

    var firstDay = new Date(year, month, 1);
    var lastDay = new Date(year, month + 1, 0);

    // Monday = 0 index for our grid
    var startDow = firstDay.getDay();
    var startOffset = (startDow === 0) ? 6 : startDow - 1; // days before first of month

    var totalDays = lastDay.getDate();
    var totalCells = startOffset + totalDays;
    var rows = Math.ceil(totalCells / 7);
    var totalSlots = rows * 7;

    var html = '<div class="cal-month-grid">';

    // Header row
    for (var h = 0; h < 7; h++) {
      html += '<div class="cal-month-header">' + DAY_NAMES[h] + '</div>';
    }

    // Day cells
    for (var i = 0; i < totalSlots; i++) {
      var dayNum = i - startOffset + 1;
      var cellDate = new Date(year, month, dayNum);
      var isOutside = dayNum < 1 || dayNum > totalDays;
      var isTodayCell = !isOutside && isToday(cellDate);

      var classes = 'cal-month-cell';
      if (isOutside) classes += ' outside';
      if (isTodayCell) classes += ' today';

      var dateAttr = escapeAttr(cellDate.getFullYear() + '-' + padTime(cellDate.getMonth() + 1) + '-' + padTime(cellDate.getDate()));

      html += '<div class="' + classes + '" data-date="' + dateAttr + '">';
      html += '<div class="cal-day-number">' + cellDate.getDate() + '</div>';

      if (!isOutside) {
        var items = getItemsForDate(cellDate);
        var maxVisible = 3;
        for (var j = 0; j < Math.min(items.length, maxVisible); j++) {
          var item = items[j];
          var color = getCategoryColor(item.categoryId);
          html += '<div class="cal-event-pill" data-id="' + escapeAttr(item.id) + '" ' +
            'style="background:' + color + '22;color:' + color + '">' +
            escapeHtml(item.title) + '</div>';
        }
        if (items.length > maxVisible) {
          html += '<div class="cal-more-link" data-date="' + dateAttr + '">+' + (items.length - maxVisible) + ' more</div>';
        }
      }

      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;

    // Bind click events
    container.addEventListener('click', function (e) {
      var pill = e.target.closest('.cal-event-pill');
      if (pill) {
        var id = pill.getAttribute('data-id');
        editEventById(id);
        return;
      }
      var moreLink = e.target.closest('.cal-more-link');
      if (moreLink) {
        var dateStr = moreLink.getAttribute('data-date');
        currentDate = new Date(dateStr + 'T12:00:00');
        viewMode = 'day';
        render();
        return;
      }
      var cell = e.target.closest('.cal-month-cell');
      if (cell && !cell.classList.contains('outside')) {
        var cellDate = cell.getAttribute('data-date');
        currentDate = new Date(cellDate + 'T12:00:00');
        viewMode = 'day';
        render();
      }
    });
  }

  /* ======================================================================
     WEEK VIEW
     ====================================================================== */
  function renderWeek() {
    var container = document.getElementById('cal-container');
    var monday = getMondayOfWeek(currentDate);
    var startHour = 6;
    var endHour = 23;
    var totalHours = endHour - startHour;
    var rowHeight = 48;

    // Header
    var html = '<div class="cal-week-header" style="grid-template-columns:60px repeat(7,1fr)">';
    html += '<div class="cal-week-header-cell" style="border-right:1px solid var(--border-subtle)"></div>';
    for (var d = 0; d < 7; d++) {
      var date = new Date(monday);
      date.setDate(date.getDate() + d);
      var todayCls = isToday(date) ? ' today' : '';
      html += '<div class="cal-week-header-cell' + todayCls + '">' +
        DAY_NAMES[d] + ' <strong>' + date.getDate() + '</strong></div>';
    }
    html += '</div>';

    // Time grid
    html += '<div class="cal-time-grid" style="grid-template-columns:60px repeat(7,1fr);grid-template-rows:repeat(' + totalHours + ',' + rowHeight + 'px)">';

    // Hour labels and rows
    for (var h = startHour; h < endHour; h++) {
      var row = h - startHour + 1;
      html += '<div class="cal-time-label" style="grid-row:' + row + ';grid-column:1">' + formatHourLabel(h) + '</div>';
      for (var c = 0; c < 7; c++) {
        html += '<div class="cal-time-row cal-day-column" data-day="' + c + '" data-hour="' + h + '" ' +
          'style="grid-row:' + row + ';grid-column:' + (c + 2) + '"></div>';
      }
    }

    // Event blocks
    for (var d = 0; d < 7; d++) {
      var dayDate = new Date(monday);
      dayDate.setDate(dayDate.getDate() + d);
      var items = getItemsForDate(dayDate);

      for (var j = 0; j < items.length; j++) {
        var item = items[j];
        var times = getItemTimes(item, dayDate);
        if (!times) continue;

        var startMin = times.start.getHours() * 60 + times.start.getMinutes();
        var endMin = times.end.getHours() * 60 + times.end.getMinutes();
        var gridStartMin = startHour * 60;
        var gridEndMin = endHour * 60;

        if (endMin <= gridStartMin || startMin >= gridEndMin) continue;
        if (startMin < gridStartMin) startMin = gridStartMin;
        if (endMin > gridEndMin) endMin = gridEndMin;

        var topPx = ((startMin - gridStartMin) / 60) * rowHeight;
        var heightPx = ((endMin - startMin) / 60) * rowHeight;
        if (heightPx < 20) heightPx = 20;

        var color = getCategoryColor(item.categoryId);
        var timeLabel = formatTime(times.start) + ' - ' + formatTime(times.end);

        html += '<div class="cal-event-block" data-id="' + escapeAttr(item.id) + '" ' +
          'style="grid-column:' + (d + 2) + ';grid-row:1/' + (totalHours + 1) + ';' +
          'top:' + topPx + 'px;height:' + heightPx + 'px;' +
          'background:' + color + '22;border-left-color:' + color + ';color:' + color + '">' +
          '<div class="cal-event-block-title">' + escapeHtml(item.title) + '</div>' +
          '<div class="cal-event-block-time">' + timeLabel + '</div>' +
          '</div>';
      }
    }

    // Current time line
    var now = new Date();
    var nowDay = -1;
    for (var nd = 0; nd < 7; nd++) {
      var checkDate = new Date(monday);
      checkDate.setDate(checkDate.getDate() + nd);
      if (isToday(checkDate)) { nowDay = nd; break; }
    }
    if (nowDay >= 0) {
      var nowMin = now.getHours() * 60 + now.getMinutes();
      var gridStart = startHour * 60;
      if (nowMin >= gridStart && nowMin < endHour * 60) {
        var nowTop = ((nowMin - gridStart) / 60) * rowHeight;
        html += '<div class="cal-now-line" style="grid-column:' + (nowDay + 2) + ';grid-row:1/' + (totalHours + 1) + ';top:' + nowTop + 'px"></div>';
      }
    }

    html += '</div>';
    container.innerHTML = html;

    // Bind clicks
    container.addEventListener('click', function (e) {
      var block = e.target.closest('.cal-event-block');
      if (block) {
        editEventById(block.getAttribute('data-id'));
        return;
      }
      var slot = e.target.closest('.cal-day-column');
      if (slot) {
        var dayIdx = parseInt(slot.getAttribute('data-day'));
        var hour = parseInt(slot.getAttribute('data-hour'));
        var slotDate = new Date(monday);
        slotDate.setDate(slotDate.getDate() + dayIdx);
        var dateStr = slotDate.getFullYear() + '-' + padTime(slotDate.getMonth() + 1) + '-' + padTime(slotDate.getDate());
        openScheduleModal(null, dateStr, padTime(hour) + ':00');
      }
    });
  }

  /* ======================================================================
     DAY VIEW
     ====================================================================== */
  function renderDay() {
    var container = document.getElementById('cal-container');
    var startHour = 6;
    var endHour = 23;
    var totalHours = endHour - startHour;
    var rowHeight = 56;

    var html = '<div class="cal-time-grid" style="grid-template-columns:60px 1fr;grid-template-rows:repeat(' + totalHours + ',' + rowHeight + 'px)">';

    for (var h = startHour; h < endHour; h++) {
      var row = h - startHour + 1;
      html += '<div class="cal-time-label" style="grid-row:' + row + ';grid-column:1">' + formatHourLabel(h) + '</div>';
      html += '<div class="cal-time-row cal-day-column" data-day="0" data-hour="' + h + '" ' +
        'style="grid-row:' + row + ';grid-column:2"></div>';
    }

    // Events
    var items = getItemsForDate(currentDate);
    for (var j = 0; j < items.length; j++) {
      var item = items[j];
      var times = getItemTimes(item, currentDate);
      if (!times) continue;

      var startMin = times.start.getHours() * 60 + times.start.getMinutes();
      var endMin = times.end.getHours() * 60 + times.end.getMinutes();
      var gridStartMin = startHour * 60;
      var gridEndMin = endHour * 60;

      if (endMin <= gridStartMin || startMin >= gridEndMin) continue;
      if (startMin < gridStartMin) startMin = gridStartMin;
      if (endMin > gridEndMin) endMin = gridEndMin;

      var topPx = ((startMin - gridStartMin) / 60) * rowHeight;
      var heightPx = ((endMin - startMin) / 60) * rowHeight;
      if (heightPx < 24) heightPx = 24;

      var color = getCategoryColor(item.categoryId);
      var timeLabel = formatTime(times.start) + ' - ' + formatTime(times.end);
      var cat = getCategoryById(item.categoryId);
      var catLabel = cat ? cat.icon + ' ' + cat.name : '';

      html += '<div class="cal-event-block" data-id="' + escapeAttr(item.id) + '" ' +
        'style="grid-column:2;grid-row:1/' + (totalHours + 1) + ';' +
        'top:' + topPx + 'px;height:' + heightPx + 'px;' +
        'background:' + color + '22;border-left-color:' + color + ';color:' + color + '">' +
        '<div class="cal-event-block-title">' + escapeHtml(item.title) + '</div>' +
        '<div class="cal-event-block-time">' + timeLabel + '</div>' +
        (heightPx > 40 && catLabel ? '<div class="cal-event-block-time">' + escapeHtml(catLabel) + '</div>' : '') +
        '</div>';
    }

    // Now line
    if (isToday(currentDate)) {
      var now = new Date();
      var nowMin = now.getHours() * 60 + now.getMinutes();
      if (nowMin >= startHour * 60 && nowMin < endHour * 60) {
        var nowTop = ((nowMin - startHour * 60) / 60) * rowHeight;
        html += '<div class="cal-now-line" style="grid-column:2;grid-row:1/' + (totalHours + 1) + ';top:' + nowTop + 'px"></div>';
      }
    }

    html += '</div>';
    container.innerHTML = html;

    // Bind clicks
    container.addEventListener('click', function (e) {
      var block = e.target.closest('.cal-event-block');
      if (block) {
        editEventById(block.getAttribute('data-id'));
        return;
      }
      var slot = e.target.closest('.cal-day-column');
      if (slot) {
        var hour = parseInt(slot.getAttribute('data-hour'));
        var dateStr = currentDate.getFullYear() + '-' + padTime(currentDate.getMonth() + 1) + '-' + padTime(currentDate.getDate());
        openScheduleModal(null, dateStr, padTime(hour) + ':00');
      }
    });
  }

  /* ======================================================================
     EDIT EVENT BY ID
     ====================================================================== */
  function editEventById(id) {
    for (var i = 0; i < schedule.length; i++) {
      if (schedule[i].id === id) {
        openScheduleModal(schedule[i], null);
        return;
      }
    }
  }

  // Expose globally for onclick fallback
  window._schEdit = editEventById;

  /* ======================================================================
     SCHEDULE MODAL (Add / Edit)
     ====================================================================== */
  function openScheduleModal(item, prefillDate, prefillTime) {
    var isEdit = !!item;
    var cats = getAllCategories();

    var catOptions = '';
    for (var i = 0; i < cats.length; i++) {
      var sel = (item && item.categoryId === cats[i].id) ? ' selected' : '';
      catOptions += '<option value="' + escapeAttr(cats[i].id) + '"' + sel + '>' + escapeHtml(cats[i].icon + ' ' + cats[i].name) + '</option>';
    }

    var dayCheckboxes = '';
    var dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (var d = 0; d < dayNames.length; d++) {
      var checked = (item && item.days && item.days.indexOf(dayNames[d]) !== -1) ? ' checked' : '';
      dayCheckboxes += '<label class="form-check" style="display:inline-flex;margin-right:var(--space-sm)">' +
        '<input type="checkbox" class="sch-day-cb" value="' + dayNames[d] + '"' + checked + '> ' + dayNames[d] +
      '</label>';
    }

    // Parse existing times or use prefill
    var startDate = '', startTime = '', endTime = '';
    if (item && item.startTime) {
      var st = new Date(item.startTime);
      startDate = st.getFullYear() + '-' + padTime(st.getMonth() + 1) + '-' + padTime(st.getDate());
      startTime = padTime(st.getHours()) + ':' + padTime(st.getMinutes());
    }
    if (item && item.endTime) {
      var et = new Date(item.endTime);
      endTime = padTime(et.getHours()) + ':' + padTime(et.getMinutes());
    }

    // Prefill from calendar click
    if (!item && prefillDate) {
      startDate = prefillDate;
    }
    if (!item && prefillTime) {
      startTime = prefillTime;
      // Default end time to 1 hour later
      var prefillHour = parseInt(prefillTime.split(':')[0]);
      endTime = padTime(Math.min(prefillHour + 1, 23)) + ':00';
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
        '<input type="date" id="sf-date" value="' + escapeAttr(startDate) + '">' +
      '</div>' +
      '<div class="grid-2">' +
        '<div class="form-group">' +
          '<label class="form-label">Start Time</label>' +
          '<input type="time" id="sf-start" value="' + escapeAttr(startTime) + '" required>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">End Time</label>' +
          '<input type="time" id="sf-end" value="' + escapeAttr(endTime) + '" required>' +
        '</div>' +
      '</div>' +
      '<div class="flex gap-1" style="justify-content:flex-end">' +
        (isEdit ? '<button type="button" class="btn btn-danger" id="sf-delete">Delete</button>' : '') +
        '<button type="button" class="btn" onclick="closeModal()">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">' + (isEdit ? 'Save' : 'Add Event') + '</button>' +
      '</div>' +
    '</form>';

    openModal(isEdit ? 'Edit Event' : 'Add Event', html);

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
        showToast('Event deleted', 'warning');
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
      showToast(isEdit ? 'Event updated' : 'Event added', 'success');
      render();
    });
  }

})();
