/**
 * EthanOS — Schedule Calendar (schedule.html)
 *
 * Full Google Calendar-style calendar with Month, Week, and Day views.
 * Navigation, add/edit/delete events via modal, category-colored events.
 * Supports all-day and multi-day events.
 */

(function () {
  'use strict';

  /* ======================================================================
     STATE
     ====================================================================== */
  var viewMode = 'month';
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

  function toDateStr(d) {
    return d.getFullYear() + '-' + padTime(d.getMonth() + 1) + '-' + padTime(d.getDate());
  }

  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];
  var MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  /* ---- Item query helpers ---- */

  function getItemsForDate(date) {
    var dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
    var ds = toDateStr(date);
    var result = [];

    for (var i = 0; i < schedule.length; i++) {
      var item = schedule[i];
      if (item.recurring && item.days && item.days.indexOf(dayName) !== -1) {
        result.push(item);
      } else if (item.allDay && item.startTime && item.endTime) {
        var startD = item.startTime.split('T')[0];
        var endD = item.endTime.split('T')[0];
        if (ds >= startD && ds <= endD) {
          result.push(item);
        }
      } else if (item.startTime && item.startTime.indexOf(ds) === 0) {
        result.push(item);
      }
    }

    result.sort(function (a, b) {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      var aTime = a.startTime ? a.startTime.split('T')[1] || '00:00' : '00:00';
      var bTime = b.startTime ? b.startTime.split('T')[1] || '00:00' : '00:00';
      return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
    });

    return result;
  }

  function getTimedItemsForDate(date) {
    return getItemsForDate(date).filter(function (item) { return !item.allDay; });
  }

  function getAllDayItemsForDate(date) {
    return getItemsForDate(date).filter(function (item) { return !!item.allDay; });
  }

  function getItemTimes(item, date) {
    if (!item.startTime || !item.endTime) return null;
    if (item.allDay) return null;

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
    if (h === 0 || h === 24) return '12 AM';
    if (h < 12) return h + ' AM';
    if (h === 12) return '12 PM';
    return (h - 12) + ' PM';
  }

  /* ---- 12-hour conversion helpers ---- */

  function to12Hour(h24, m) {
    var ampm = h24 >= 12 ? 'PM' : 'AM';
    var h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return { hour: h12, minute: m, ampm: ampm };
  }

  function to24Hour(h12, m, ampm) {
    var h24 = h12;
    if (ampm === 'AM') {
      if (h12 === 12) h24 = 0;
    } else {
      if (h12 !== 12) h24 = h12 + 12;
    }
    return { hour: h24, minute: m };
  }

  function buildHourOptions(selected) {
    var html = '';
    for (var h = 1; h <= 12; h++) {
      html += '<option value="' + h + '"' + (h === selected ? ' selected' : '') + '>' + h + '</option>';
    }
    return html;
  }

  function buildMinuteOptions(selected) {
    var html = '';
    for (var m = 0; m < 60; m += 5) {
      html += '<option value="' + m + '"' + (m === selected ? ' selected' : '') + '>' + padTime(m) + '</option>';
    }
    return html;
  }

  function roundMinute(m) {
    return Math.round(m / 5) * 5 % 60;
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
    document.getElementById('cal-prev').addEventListener('click', function () { navigate(-1); });
    document.getElementById('cal-next').addEventListener('click', function () { navigate(1); });
    document.getElementById('cal-today').addEventListener('click', function () {
      currentDate = new Date();
      render();
    });
    document.getElementById('cal-month-btn').addEventListener('click', function () {
      viewMode = 'month'; render();
    });
    document.getElementById('cal-week-btn').addEventListener('click', function () {
      viewMode = 'week'; render();
    });
    document.getElementById('cal-day-btn').addEventListener('click', function () {
      viewMode = 'day'; render();
    });
    document.getElementById('cal-add-btn').addEventListener('click', function () {
      var prefill = null;
      if (viewMode === 'day' || viewMode === 'week') {
        prefill = toDateStr(currentDate);
      }
      openScheduleModal(null, prefill);
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
    document.getElementById('cal-month-btn').className = viewMode === 'month' ? 'btn btn-primary btn-sm' : 'btn btn-sm';
    document.getElementById('cal-week-btn').className = viewMode === 'week' ? 'btn btn-primary btn-sm' : 'btn btn-sm';
    document.getElementById('cal-day-btn').className = viewMode === 'day' ? 'btn btn-primary btn-sm' : 'btn btn-sm';
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

    var startDow = firstDay.getDay();
    var startOffset = (startDow === 0) ? 6 : startDow - 1;

    var totalDays = lastDay.getDate();
    var totalCells = startOffset + totalDays;
    var rows = Math.ceil(totalCells / 7);
    var totalSlots = rows * 7;

    var html = '<div class="cal-month-grid">';

    for (var h = 0; h < 7; h++) {
      html += '<div class="cal-month-header">' + DAY_NAMES[h] + '</div>';
    }

    for (var i = 0; i < totalSlots; i++) {
      var dayNum = i - startOffset + 1;
      var cellDate = new Date(year, month, dayNum);
      var isOutside = dayNum < 1 || dayNum > totalDays;
      var isTodayCell = !isOutside && isToday(cellDate);

      var classes = 'cal-month-cell';
      if (isOutside) classes += ' outside';
      if (isTodayCell) classes += ' today';

      var dateAttr = escapeAttr(toDateStr(cellDate));

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

    container.addEventListener('click', function (e) {
      var pill = e.target.closest('.cal-event-pill');
      if (pill) {
        editEventById(pill.getAttribute('data-id'));
        return;
      }
      var moreLink = e.target.closest('.cal-more-link');
      if (moreLink) {
        var ds = moreLink.getAttribute('data-date');
        currentDate = new Date(ds + 'T12:00:00');
        viewMode = 'day';
        render();
        return;
      }
      var cell = e.target.closest('.cal-month-cell');
      if (cell && !cell.classList.contains('outside')) {
        var cellDateStr = cell.getAttribute('data-date');
        currentDate = new Date(cellDateStr + 'T12:00:00');
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
    var startHour = 0;
    var endHour = 24;
    var totalHours = endHour - startHour;
    var rowHeight = 48;

    var html = '';

    // All-day banner
    var hasAnyAllDay = false;
    for (var chk = 0; chk < 7; chk++) {
      var chkDate = new Date(monday);
      chkDate.setDate(chkDate.getDate() + chk);
      if (getAllDayItemsForDate(chkDate).length > 0) { hasAnyAllDay = true; break; }
    }

    if (hasAnyAllDay) {
      html += '<div class="cal-allday-section">';
      html += '<div style="display:grid;grid-template-columns:60px repeat(7,1fr);gap:2px">';
      html += '<div class="text-xs text-muted" style="display:flex;align-items:center;justify-content:flex-end;padding-right:var(--space-sm)">all-day</div>';
      for (var dc = 0; dc < 7; dc++) {
        var dcDate = new Date(monday);
        dcDate.setDate(dcDate.getDate() + dc);
        var dcItems = getAllDayItemsForDate(dcDate);
        html += '<div>';
        for (var dci = 0; dci < dcItems.length; dci++) {
          var dcItem = dcItems[dci];
          var dcColor = getCategoryColor(dcItem.categoryId);
          html += '<div class="cal-event-pill" data-id="' + escapeAttr(dcItem.id) + '" ' +
            'style="background:' + dcColor + '22;color:' + dcColor + '">' +
            escapeHtml(dcItem.title) + '</div>';
        }
        html += '</div>';
      }
      html += '</div></div>';
    }

    // Header
    html += '<div class="cal-week-header" style="grid-template-columns:60px repeat(7,1fr)">';
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

    for (var h = startHour; h < endHour; h++) {
      var row = h - startHour + 1;
      html += '<div class="cal-time-label" style="grid-row:' + row + ';grid-column:1">' + formatHourLabel(h) + '</div>';
      for (var c = 0; c < 7; c++) {
        html += '<div class="cal-time-row cal-day-column" data-day="' + c + '" data-hour="' + h + '" ' +
          'style="grid-row:' + row + ';grid-column:' + (c + 2) + '"></div>';
      }
    }

    // Timed events
    for (var d2 = 0; d2 < 7; d2++) {
      var dayDate = new Date(monday);
      dayDate.setDate(dayDate.getDate() + d2);
      var items = getTimedItemsForDate(dayDate);

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
          'style="grid-column:' + (d2 + 2) + ';grid-row:1/' + (totalHours + 1) + ';' +
          'top:' + topPx + 'px;height:' + heightPx + 'px;' +
          'background:' + color + '22;border-left-color:' + color + ';color:' + color + '">' +
          '<div class="cal-event-block-title">' + escapeHtml(item.title) + '</div>' +
          '<div class="cal-event-block-time">' + timeLabel + '</div>' +
          '</div>';
      }
    }

    // Now line
    var now = new Date();
    var nowDay = -1;
    for (var nd = 0; nd < 7; nd++) {
      var checkDate = new Date(monday);
      checkDate.setDate(checkDate.getDate() + nd);
      if (isToday(checkDate)) { nowDay = nd; break; }
    }
    if (nowDay >= 0) {
      var nowMin = now.getHours() * 60 + now.getMinutes();
      if (nowMin >= startHour * 60 && nowMin < endHour * 60) {
        var nowTop = ((nowMin - startHour * 60) / 60) * rowHeight;
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
      var pill = e.target.closest('.cal-event-pill');
      if (pill) {
        editEventById(pill.getAttribute('data-id'));
        return;
      }
      var slot = e.target.closest('.cal-day-column');
      if (slot) {
        var dayIdx = parseInt(slot.getAttribute('data-day'));
        var hour = parseInt(slot.getAttribute('data-hour'));
        var slotDate = new Date(monday);
        slotDate.setDate(slotDate.getDate() + dayIdx);
        openScheduleModal(null, toDateStr(slotDate), padTime(hour) + ':00');
      }
    });
  }

  /* ======================================================================
     DAY VIEW
     ====================================================================== */
  function renderDay() {
    var container = document.getElementById('cal-container');
    var startHour = 0;
    var endHour = 24;
    var totalHours = endHour - startHour;
    var rowHeight = 56;

    var html = '';

    // All-day banner
    var allDayItems = getAllDayItemsForDate(currentDate);
    if (allDayItems.length > 0) {
      html += '<div class="cal-allday-section" style="padding-left:60px">';
      html += '<span class="text-xs text-muted" style="margin-right:var(--space-sm)">all-day</span>';
      for (var ai = 0; ai < allDayItems.length; ai++) {
        var adItem = allDayItems[ai];
        var adColor = getCategoryColor(adItem.categoryId);
        html += '<span class="cal-event-pill" data-id="' + escapeAttr(adItem.id) + '" ' +
          'style="background:' + adColor + '22;color:' + adColor + ';display:inline-block">' +
          escapeHtml(adItem.title) + '</span> ';
      }
      html += '</div>';
    }

    // Time grid
    html += '<div class="cal-time-grid" style="grid-template-columns:60px 1fr;grid-template-rows:repeat(' + totalHours + ',' + rowHeight + 'px)">';

    for (var h = startHour; h < endHour; h++) {
      var row = h - startHour + 1;
      html += '<div class="cal-time-label" style="grid-row:' + row + ';grid-column:1">' + formatHourLabel(h) + '</div>';
      html += '<div class="cal-time-row cal-day-column" data-day="0" data-hour="' + h + '" ' +
        'style="grid-row:' + row + ';grid-column:2"></div>';
    }

    // Timed events
    var items = getTimedItemsForDate(currentDate);
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
      var pill = e.target.closest('.cal-event-pill');
      if (pill) {
        editEventById(pill.getAttribute('data-id'));
        return;
      }
      var slot = e.target.closest('.cal-day-column');
      if (slot) {
        var hour = parseInt(slot.getAttribute('data-hour'));
        openScheduleModal(null, toDateStr(currentDate), padTime(hour) + ':00');
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

    // Determine flags
    var isAllDay = item ? !!item.allDay : false;
    var isRecurring = item ? !!item.recurring : false;

    // Parse times
    var startDate = '', endDate = '';
    var startH12 = 9, startMin = 0, startAMPM = 'AM';
    var endH12 = 10, endMin = 0, endAMPM = 'AM';

    if (item && item.startTime) {
      var st = new Date(item.startTime);
      startDate = st.getFullYear() + '-' + padTime(st.getMonth() + 1) + '-' + padTime(st.getDate());
      if (!isAllDay) {
        var stParts = to12Hour(st.getHours(), roundMinute(st.getMinutes()));
        startH12 = stParts.hour;
        startMin = stParts.minute;
        startAMPM = stParts.ampm;
      }
    }
    if (item && item.endTime) {
      var et = new Date(item.endTime);
      endDate = et.getFullYear() + '-' + padTime(et.getMonth() + 1) + '-' + padTime(et.getDate());
      if (!isAllDay) {
        var etParts = to12Hour(et.getHours(), roundMinute(et.getMinutes()));
        endH12 = etParts.hour;
        endMin = etParts.minute;
        endAMPM = etParts.ampm;
      }
    }

    // Prefill from calendar context
    if (!item && prefillDate) {
      startDate = prefillDate;
      endDate = prefillDate;
    }
    if (!item && !prefillDate) {
      startDate = toDateStr(new Date());
      endDate = toDateStr(new Date());
    }
    if (!item && prefillTime) {
      var ph = parseInt(prefillTime.split(':')[0]);
      var pm = parseInt(prefillTime.split(':')[1]) || 0;
      var pParts = to12Hour(ph, roundMinute(pm));
      startH12 = pParts.hour;
      startMin = pParts.minute;
      startAMPM = pParts.ampm;
      var ehour = Math.min(ph + 1, 23);
      var eParts2 = to12Hour(ehour, 0);
      endH12 = eParts2.hour;
      endMin = eParts2.minute;
      endAMPM = eParts2.ampm;
    }

    if (!endDate) endDate = startDate;

    // Visibility flags
    var showDateGroup = !isAllDay && !isRecurring;
    var showDaysGroup = !isAllDay && isRecurring;

    var html = '<form id="sch-form">' +
      '<div class="form-group">' +
        '<label class="form-label">Title</label>' +
        '<input type="text" id="sf-title" value="' + escapeAttr(item ? item.title : '') + '" required>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Category</label>' +
        '<select id="sf-category">' + catOptions + '</select>' +
      '</div>' +
      // All-day toggle
      '<div class="form-group">' +
        '<label class="form-label">All Day / Multi-Day</label>' +
        '<div class="flex gap-2 items-center">' +
          '<label class="toggle"><input type="checkbox" id="sf-allday"' + (isAllDay ? ' checked' : '') + '>' +
            '<span class="toggle-slider"></span></label>' +
          '<span class="text-sm text-secondary">Spans full days (no specific times)</span>' +
        '</div>' +
      '</div>' +
      // Recurring toggle
      '<div class="form-group" id="sf-recurring-group"' + (isAllDay ? ' style="display:none"' : '') + '>' +
        '<label class="form-label">Recurring?</label>' +
        '<div class="flex gap-2 items-center">' +
          '<label class="toggle"><input type="checkbox" id="sf-recurring"' + (isRecurring ? ' checked' : '') + '>' +
            '<span class="toggle-slider"></span></label>' +
          '<span class="text-sm text-secondary">Repeat weekly</span>' +
        '</div>' +
      '</div>' +
      // Recurring days
      '<div class="form-group" id="sf-days-group"' + (showDaysGroup ? '' : ' style="display:none"') + '>' +
        '<label class="form-label">Days</label>' +
        '<div>' + dayCheckboxes + '</div>' +
      '</div>' +
      // Single date (for timed, non-recurring events)
      '<div class="form-group" id="sf-date-group"' + (showDateGroup ? '' : ' style="display:none"') + '>' +
        '<label class="form-label">Date</label>' +
        '<input type="date" id="sf-date" value="' + escapeAttr(startDate) + '">' +
      '</div>' +
      // Multi-day date range (for all-day events)
      '<div id="sf-allday-dates"' + (isAllDay ? '' : ' style="display:none"') + '>' +
        '<div class="grid-2">' +
          '<div class="form-group">' +
            '<label class="form-label">Start Date</label>' +
            '<input type="date" id="sf-start-date" value="' + escapeAttr(startDate) + '">' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">End Date</label>' +
            '<input type="date" id="sf-end-date" value="' + escapeAttr(endDate) + '">' +
          '</div>' +
        '</div>' +
      '</div>' +
      // Time dropdowns (hidden when all-day)
      '<div class="grid-2" id="sf-time-group"' + (isAllDay ? ' style="display:none"' : '') + '>' +
        '<div class="form-group">' +
          '<label class="form-label">Start Time</label>' +
          '<div class="flex gap-1">' +
            '<select id="sf-start-hour" style="width:auto;min-width:55px">' + buildHourOptions(startH12) + '</select>' +
            '<span class="text-secondary" style="line-height:40px;font-weight:700">:</span>' +
            '<select id="sf-start-min" style="width:auto;min-width:60px">' + buildMinuteOptions(startMin) + '</select>' +
            '<select id="sf-start-ampm" style="width:auto;min-width:60px">' +
              '<option value="AM"' + (startAMPM === 'AM' ? ' selected' : '') + '>AM</option>' +
              '<option value="PM"' + (startAMPM === 'PM' ? ' selected' : '') + '>PM</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">End Time</label>' +
          '<div class="flex gap-1">' +
            '<select id="sf-end-hour" style="width:auto;min-width:55px">' + buildHourOptions(endH12) + '</select>' +
            '<span class="text-secondary" style="line-height:40px;font-weight:700">:</span>' +
            '<select id="sf-end-min" style="width:auto;min-width:60px">' + buildMinuteOptions(endMin) + '</select>' +
            '<select id="sf-end-ampm" style="width:auto;min-width:60px">' +
              '<option value="AM"' + (endAMPM === 'AM' ? ' selected' : '') + '>AM</option>' +
              '<option value="PM"' + (endAMPM === 'PM' ? ' selected' : '') + '>PM</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="flex gap-1" style="justify-content:flex-end">' +
        (isEdit ? '<button type="button" class="btn btn-danger" id="sf-delete">Delete</button>' : '') +
        '<button type="button" class="btn" onclick="closeModal()">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">' + (isEdit ? 'Save' : 'Add Event') + '</button>' +
      '</div>' +
    '</form>';

    openModal(isEdit ? 'Edit Event' : 'Add Event', html);

    // All-day toggle handler
    document.getElementById('sf-allday').addEventListener('change', function () {
      var on = this.checked;
      document.getElementById('sf-time-group').style.display = on ? 'none' : '';
      document.getElementById('sf-allday-dates').style.display = on ? '' : 'none';
      document.getElementById('sf-date-group').style.display = on ? 'none' : (document.getElementById('sf-recurring').checked ? 'none' : '');
      document.getElementById('sf-recurring-group').style.display = on ? 'none' : '';
      document.getElementById('sf-days-group').style.display = 'none';
      if (on) {
        document.getElementById('sf-recurring').checked = false;
        // Sync dates
        var d = document.getElementById('sf-date').value;
        if (d) {
          if (!document.getElementById('sf-start-date').value) document.getElementById('sf-start-date').value = d;
          if (!document.getElementById('sf-end-date').value) document.getElementById('sf-end-date').value = d;
        }
      } else {
        var sd = document.getElementById('sf-start-date').value;
        if (sd) document.getElementById('sf-date').value = sd;
      }
    });

    // Recurring toggle handler
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

      var allDay = document.getElementById('sf-allday').checked;
      var recurring = document.getElementById('sf-recurring').checked;
      var categoryId = document.getElementById('sf-category').value;
      var startISO, endISO;
      var days = [];

      if (allDay) {
        recurring = false;
        var sd = document.getElementById('sf-start-date').value;
        var ed = document.getElementById('sf-end-date').value;
        if (!sd) sd = toDateStr(new Date());
        if (!ed) ed = sd;
        startISO = sd + 'T00:00:00';
        endISO = ed + 'T23:59:00';
      } else {
        var dateVal = document.getElementById('sf-date').value || toDateStr(new Date());

        if (recurring) {
          var cbs = document.querySelectorAll('.sch-day-cb:checked');
          for (var c = 0; c < cbs.length; c++) days.push(cbs[c].value);
        }

        var sh = parseInt(document.getElementById('sf-start-hour').value);
        var sm = parseInt(document.getElementById('sf-start-min').value);
        var sap = document.getElementById('sf-start-ampm').value;
        var s24 = to24Hour(sh, sm, sap);

        var eh = parseInt(document.getElementById('sf-end-hour').value);
        var em = parseInt(document.getElementById('sf-end-min').value);
        var eap = document.getElementById('sf-end-ampm').value;
        var e24 = to24Hour(eh, em, eap);

        startISO = dateVal + 'T' + padTime(s24.hour) + ':' + padTime(s24.minute) + ':00';
        endISO = dateVal + 'T' + padTime(e24.hour) + ':' + padTime(e24.minute) + ':00';
      }

      if (isEdit) {
        item.title = title;
        item.categoryId = categoryId;
        item.recurring = recurring;
        item.days = days;
        item.startTime = startISO;
        item.endTime = endISO;
        item.allDay = allDay;
      } else {
        schedule.push({
          id: generateId(),
          title: title,
          categoryId: categoryId,
          startTime: startISO,
          endTime: endISO,
          recurring: recurring,
          days: days,
          allDay: allDay
        });
      }

      await window.EthanOSData.saveData('schedule', schedule);
      closeModal();
      showToast(isEdit ? 'Event updated' : 'Event added', 'success');
      render();
    });
  }

})();
