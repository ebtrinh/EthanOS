/**
 * EthanOS — Command Center (index.html)
 *
 * Shows: current time, free time today, top 3 priority tasks,
 * next deadline countdown, streak tracker, quick-add task form,
 * and today's schedule mini-timeline.
 */

(function () {
  'use strict';

  var tasks = [];
  var schedule = [];
  var focusSessions = [];
  var categories = [];
  var xpData = {};

  /* ======================================================================
     BOOT
     ====================================================================== */
  document.addEventListener('DOMContentLoaded', function () {
    // Wait for shared.js boot to finish, then load our data
    setTimeout(async function () {
      await loadAllData();
      populateCategorySelect();
      render();
      startClockTicker();
      bindQuickAdd();
    }, 400);
  });

  async function loadAllData() {
    tasks = await window.EthanOSData.loadData('tasks', []);
    schedule = await window.EthanOSData.loadData('schedule', []);
    focusSessions = await window.EthanOSData.loadData('focusSessions', []);
    categories = getAllCategories();
    xpData = await window.EthanOSData.loadData('xp', { totalXp: 0, streaks: {} });
  }

  /* ======================================================================
     CLOCK — large time display
     ====================================================================== */
  function startClockTicker() {
    function tick() {
      var now = new Date();
      var h = now.getHours();
      var m = now.getMinutes();
      var ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      var el = document.getElementById('current-time');
      if (el) el.textContent = h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
    }
    tick();
    setInterval(tick, 5000);
  }

  /* ======================================================================
     RENDER
     ====================================================================== */
  function render() {
    renderFreeTime();
    renderPriorityTasks();
    renderDeadlineCountdown();
    renderStreaks();
    renderMiniTimeline();
  }

  /* ======================================================================
     FREE TIME TODAY
     ====================================================================== */
  function renderFreeTime() {
    var today = new Date();
    var dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][today.getDay()];
    var todayStr = today.toISOString().split('T')[0];

    // Count scheduled minutes today (6am - 11pm = 17 hours = 1020 min)
    var totalDayMinutes = 17 * 60;
    var scheduledMinutes = 0;

    for (var i = 0; i < schedule.length; i++) {
      var item = schedule[i];
      var isToday = false;

      if (item.recurring && item.days && item.days.indexOf(dayName) !== -1) {
        isToday = true;
      } else if (item.startTime && item.startTime.indexOf(todayStr) === 0) {
        isToday = true;
      }

      if (isToday && item.startTime && item.endTime) {
        var start = new Date(item.startTime);
        var end = new Date(item.endTime);
        // For recurring items, use just time portion
        if (item.recurring) {
          var parts = item.startTime.split('T');
          var endParts = item.endTime.split('T');
          if (parts.length > 1 && endParts.length > 1) {
            start = parseTimeToday(parts[1]);
            end = parseTimeToday(endParts[1]);
          }
        }
        var dur = (end - start) / 60000;
        if (dur > 0) scheduledMinutes += dur;
      }
    }

    var freeMinutes = Math.max(0, totalDayMinutes - scheduledMinutes);
    var freeH = Math.floor(freeMinutes / 60);
    var freeM = freeMinutes % 60;

    var el = document.getElementById('free-time');
    if (el) el.textContent = freeH + 'h ' + freeM + 'm';
  }

  function parseTimeToday(timeStr) {
    // timeStr like "14:30" or "14:30:00"
    var parts = timeStr.split(':');
    var d = new Date();
    d.setHours(parseInt(parts[0]) || 0, parseInt(parts[1]) || 0, 0, 0);
    return d;
  }

  /* ======================================================================
     PRIORITY TASKS — top 3 by soonest due + highest difficulty
     ====================================================================== */
  function renderPriorityTasks() {
    var incomplete = tasks.filter(function (t) { return !t.completed; });

    // Sort: due date ascending, then difficulty descending
    incomplete.sort(function (a, b) {
      var dA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      var dB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      if (dA !== dB) return dA - dB;
      return (b.difficulty || 0) - (a.difficulty || 0);
    });

    var top3 = incomplete.slice(0, 3);
    var container = document.getElementById('priority-tasks');
    var countEl = document.getElementById('task-count');
    if (countEl) countEl.textContent = incomplete.length + ' pending';

    if (top3.length === 0) {
      container.innerHTML = '<div class="empty-state">' +
        '<div class="empty-state-icon">&#9989;</div>' +
        '<div class="empty-state-title">All clear!</div>' +
        '<div class="empty-state-text">No pending tasks. Add one below.</div></div>';
      return;
    }

    var html = '';
    for (var i = 0; i < top3.length; i++) {
      var t = top3[i];
      var now = new Date();
      var due = t.dueDate ? new Date(t.dueDate) : null;
      var badgeHTML = '';
      if (due) {
        var diffMs = due - now;
        var diffDays = Math.ceil(diffMs / 86400000);
        if (diffDays < 0) {
          badgeHTML = '<span class="badge badge-danger">Overdue</span>';
        } else if (diffDays <= 2) {
          badgeHTML = '<span class="badge badge-warning">Due soon</span>';
        }
      }

      html += '<div class="list-item">' +
        '<div class="flex-1">' +
          '<div class="flex items-center gap-1">' +
            '<strong>' + escapeHtml(t.title) + '</strong> ' + badgeHTML +
          '</div>' +
          '<div class="flex items-center gap-1 mt-1 text-sm text-secondary">' +
            getCategoryBadgeHTML(t.categoryId) + ' ' +
            createStarRating(t.difficulty || 1) +
            (due ? ' <span class="text-muted">' + formatDate(due) + '</span>' : '') +
            (t.estimatedMinutes ? ' <span class="text-muted">' + t.estimatedMinutes + ' min</span>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    }
    container.innerHTML = html;
  }

  /* ======================================================================
     DEADLINE COUNTDOWN — next hard deadline
     ====================================================================== */
  function renderDeadlineCountdown() {
    var now = new Date();
    var nextTask = null;
    var nearestDue = Infinity;

    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      if (t.completed || !t.dueDate) continue;
      var due = new Date(t.dueDate).getTime();
      if (due > now.getTime() && due < nearestDue) {
        nearestDue = due;
        nextTask = t;
      }
    }

    var countdownEl = document.getElementById('deadline-countdown');
    var nameEl = document.getElementById('deadline-name');

    if (!nextTask) {
      if (countdownEl) countdownEl.textContent = '--';
      if (nameEl) nameEl.textContent = 'No upcoming deadlines';
      return;
    }

    var diffMs = nearestDue - now.getTime();
    var days = Math.floor(diffMs / 86400000);
    var hours = Math.floor((diffMs % 86400000) / 3600000);

    if (countdownEl) {
      if (days > 0) {
        countdownEl.textContent = days + 'd ' + hours + 'h';
      } else {
        countdownEl.textContent = hours + 'h';
      }
    }
    if (nameEl) nameEl.textContent = nextTask.title;
  }

  /* ======================================================================
     STREAKS — per category based on focus sessions
     ====================================================================== */
  function renderStreaks() {
    var container = document.getElementById('streak-tracker');
    var streaks = xpData.streaks || {};
    var catIds = Object.keys(streaks);

    if (catIds.length === 0) {
      // Build from focus sessions
      var sessionsByCategory = {};
      for (var i = 0; i < focusSessions.length; i++) {
        var s = focusSessions[i];
        if (!s.categoryId) continue;
        if (!sessionsByCategory[s.categoryId]) sessionsByCategory[s.categoryId] = [];
        sessionsByCategory[s.categoryId].push(s);
      }

      var catKeys = Object.keys(sessionsByCategory);
      if (catKeys.length === 0) {
        container.innerHTML = '<div class="empty-state">' +
          '<div class="empty-state-icon">&#128293;</div>' +
          '<div class="empty-state-title">No streaks yet</div>' +
          '<div class="empty-state-text">Complete focus sessions to build streaks</div></div>';
        return;
      }

      // Calculate streaks from consecutive days of focus sessions
      var html = '';
      for (var j = 0; j < catKeys.length; j++) {
        var catId = catKeys[j];
        var sessions = sessionsByCategory[catId];
        var streak = calcStreak(sessions);
        var cat = getCategoryById(catId);
        var catName = cat ? cat.icon + ' ' + cat.name : catId;
        var color = cat ? getCategoryColor(catId) : 'var(--text-muted)';

        html += '<div class="list-item">' +
          '<span style="color:' + color + ';font-size:1.2rem">' + (cat ? cat.icon : '') + '</span>' +
          '<div class="flex-1">' +
            '<div class="font-bold">' + (cat ? cat.name : catId) + '</div>' +
            '<div class="text-sm text-secondary">' + streak + ' day streak</div>' +
          '</div>' +
          '<span class="badge" style="background:' + color + '22;color:' + color + '">' + streak + 'd</span>' +
        '</div>';
      }
      container.innerHTML = html;
      return;
    }

    // Use stored streaks
    var html = '';
    for (var k = 0; k < catIds.length; k++) {
      var cat = getCategoryById(catIds[k]);
      var color = getCategoryColor(catIds[k]);
      var val = streaks[catIds[k]] || 0;
      html += '<div class="list-item">' +
        '<span style="color:' + color + ';font-size:1.2rem">' + (cat ? cat.icon : '') + '</span>' +
        '<div class="flex-1">' +
          '<div class="font-bold">' + (cat ? cat.name : catIds[k]) + '</div>' +
          '<div class="text-sm text-secondary">' + val + ' day streak</div>' +
        '</div>' +
        '<span class="badge" style="background:' + color + '22;color:' + color + '">' + val + 'd</span>' +
      '</div>';
    }
    container.innerHTML = html;
  }

  function calcStreak(sessions) {
    if (!sessions || sessions.length === 0) return 0;
    // Get unique dates
    var dates = {};
    for (var i = 0; i < sessions.length; i++) {
      var d = new Date(sessions[i].startTime || sessions[i].endTime);
      dates[d.toISOString().split('T')[0]] = true;
    }
    // Count consecutive days ending today or yesterday
    var today = new Date();
    var streak = 0;
    for (var d = 0; d < 365; d++) {
      var check = new Date(today);
      check.setDate(check.getDate() - d);
      var key = check.toISOString().split('T')[0];
      if (dates[key]) {
        streak++;
      } else {
        if (d === 0) continue; // Today hasn't necessarily passed
        break;
      }
    }
    return streak;
  }

  /* ======================================================================
     MINI TIMELINE — today's schedule blocks
     ====================================================================== */
  function renderMiniTimeline() {
    var container = document.getElementById('mini-timeline');
    var today = new Date();
    var dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][today.getDay()];
    var todayStr = today.toISOString().split('T')[0];

    var todayItems = [];
    for (var i = 0; i < schedule.length; i++) {
      var item = schedule[i];
      var isToday = false;
      if (item.recurring && item.days && item.days.indexOf(dayName) !== -1) {
        isToday = true;
      } else if (item.startTime && item.startTime.indexOf(todayStr) === 0) {
        isToday = true;
      }
      if (isToday) todayItems.push(item);
    }

    if (todayItems.length === 0) {
      container.innerHTML = '<div class="empty-state">' +
        '<div class="empty-state-icon">&#128197;</div>' +
        '<div class="empty-state-title">Nothing scheduled</div>' +
        '<div class="empty-state-text">Add schedule items to see your day</div></div>';
      return;
    }

    // Sort by start time
    todayItems.sort(function (a, b) {
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

    var html = '<div style="position:relative;padding-left:16px;border-left:2px solid var(--border-color)">';
    for (var j = 0; j < todayItems.length; j++) {
      var s = todayItems[j];
      var color = getCategoryColor(s.categoryId);
      var start = s.startTime ? formatTime(s.startTime) : '';
      var end = s.endTime ? formatTime(s.endTime) : '';

      html += '<div style="margin-bottom:var(--space-md);position:relative">' +
        '<div style="position:absolute;left:-21px;top:4px;width:10px;height:10px;border-radius:50%;background:' + color + '"></div>' +
        '<div class="text-xs text-muted">' + start + (end ? ' - ' + end : '') + '</div>' +
        '<div class="font-bold text-sm" style="color:' + color + '">' + escapeHtml(s.title) + '</div>' +
        getCategoryBadgeHTML(s.categoryId) +
      '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
  }

  /* ======================================================================
     QUICK ADD FORM
     ====================================================================== */
  function populateCategorySelect() {
    var select = document.getElementById('qa-category');
    if (!select) return;
    var cats = getAllCategories();
    select.innerHTML = '';
    for (var i = 0; i < cats.length; i++) {
      var opt = document.createElement('option');
      opt.value = cats[i].id;
      opt.textContent = cats[i].icon + ' ' + cats[i].name;
      select.appendChild(opt);
    }
  }

  function bindQuickAdd() {
    var form = document.getElementById('quick-add-form');
    if (!form) return;
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      var title = document.getElementById('qa-title').value.trim();
      if (!title) return;

      var newTask = {
        id: generateId(),
        title: title,
        categoryId: document.getElementById('qa-category').value,
        difficulty: parseInt(document.getElementById('qa-difficulty').value) || 3,
        dueDate: document.getElementById('qa-due').value || null,
        estimatedMinutes: parseInt(document.getElementById('qa-minutes').value) || null,
        completed: false,
        actualMinutes: null,
        completedAt: null,
        createdAt: new Date().toISOString()
      };

      tasks.push(newTask);
      await window.EthanOSData.saveData('tasks', tasks);

      showToast('Task added: ' + title, 'success');
      form.reset();
      populateCategorySelect();
      render();
    });
  }

  /* ======================================================================
     UTIL
     ====================================================================== */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

})();
