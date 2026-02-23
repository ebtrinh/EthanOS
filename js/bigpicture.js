/**
 * EthanOS — Big Picture View
 * Side-by-side comparison of actual vs target time allocation.
 */
(function () {
  'use strict';

  var categories = [];
  var focusSessions = [];
  var schedule = [];

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(init, 350);
  });

  async function init() {
    categories = getAllCategories();
    focusSessions = await window.EthanOSData.loadData('focusSessions', []);
    schedule = await window.EthanOSData.loadData('schedule', []);
    render();
  }

  /* ========================================================================
     HELPERS
     ======================================================================== */
  function getWeekStart(date) {
    var d = new Date(date);
    var day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function getSessionsForWeek(weekStart) {
    var weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return focusSessions.filter(function (s) {
      var d = new Date(s.startTime || s.endTime);
      return d >= weekStart && d < weekEnd;
    });
  }

  function getHoursByCategory(sessions) {
    var map = {};
    for (var i = 0; i < sessions.length; i++) {
      var s = sessions[i];
      var catId = s.categoryId || 'unknown';
      var hours = (s.duration || 0) / 60;
      map[catId] = (map[catId] || 0) + hours;
    }
    return map;
  }

  function getTotalHours(hourMap) {
    var total = 0;
    var keys = Object.keys(hourMap);
    for (var i = 0; i < keys.length; i++) total += hourMap[keys[i]];
    return total;
  }

  /* ========================================================================
     RENDER
     ======================================================================== */
  function render() {
    var now = new Date();
    var thisWeekStart = getWeekStart(now);
    var lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    var thisWeekSessions = getSessionsForWeek(thisWeekStart);
    var lastWeekSessions = getSessionsForWeek(lastWeekStart);

    var thisWeekHours = getHoursByCategory(thisWeekSessions);
    var lastWeekHours = getHoursByCategory(lastWeekSessions);

    var thisTotal = getTotalHours(thisWeekHours);
    var lastTotal = getTotalHours(lastWeekHours);
    var totalDiff = thisTotal - lastTotal;

    // Stats row
    document.getElementById('stats-row').innerHTML =
      '<div class="card stat-card">' +
        '<div class="stat-number accent">' + thisTotal.toFixed(1) + 'h</div>' +
        '<div class="stat-label">This Week</div>' +
      '</div>' +
      '<div class="card stat-card">' +
        '<div class="stat-number">' + lastTotal.toFixed(1) + 'h</div>' +
        '<div class="stat-label">Last Week</div>' +
      '</div>' +
      '<div class="card stat-card">' +
        '<div class="stat-number ' + (totalDiff >= 0 ? 'success' : 'danger') + '">' +
          (totalDiff >= 0 ? '+' : '') + totalDiff.toFixed(1) + 'h</div>' +
        '<div class="stat-label">Difference</div>' +
      '</div>' +
      '<div class="card stat-card">' +
        '<div class="stat-number">' + categories.length + '</div>' +
        '<div class="stat-label">Categories</div>' +
      '</div>';

    // Find max hours for bar scaling
    var maxHours = 1;
    for (var i = 0; i < categories.length; i++) {
      var cat = categories[i];
      var actual = thisWeekHours[cat.id] || 0;
      var target = cat.weeklyHoursTarget || 0;
      if (actual > maxHours) maxHours = actual;
      if (target > maxHours) maxHours = target;
    }

    // Bars container
    var barsHTML = '';
    var insights = [];
    var gapHTML = '';

    for (var j = 0; j < categories.length; j++) {
      var c = categories[j];
      var actualHrs = thisWeekHours[c.id] || 0;
      var targetHrs = c.weeklyHoursTarget || 0;
      var actualPct = maxHours > 0 ? (actualHrs / maxHours) * 100 : 0;
      var targetPct = maxHours > 0 ? (targetHrs / maxHours) * 100 : 0;
      var color = getCategoryColor(c.id);
      var gap = actualHrs - targetHrs;
      var gapAbs = Math.abs(gap).toFixed(1);

      barsHTML += '<div style="margin-bottom:var(--space-lg)">' +
        '<div class="flex-between mb-1">' +
          '<span class="font-bold">' + c.icon + ' ' + c.name + '</span>' +
          '<span class="text-sm text-muted">' + actualHrs.toFixed(1) + 'h / ' + targetHrs + 'h target</span>' +
        '</div>' +
        '<div style="display:flex;gap:var(--space-sm);align-items:center">' +
          '<span class="text-xs text-muted" style="width:50px">Actual</span>' +
          '<div style="flex:1;height:14px;background:var(--bg-primary);border-radius:7px;overflow:hidden">' +
            '<div style="width:' + actualPct + '%;height:100%;background:' + color + ';border-radius:7px;transition:width 0.4s"></div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:var(--space-sm);align-items:center;margin-top:4px">' +
          '<span class="text-xs text-muted" style="width:50px">Target</span>' +
          '<div style="flex:1;height:14px;background:var(--bg-primary);border-radius:7px;overflow:hidden">' +
            '<div style="width:' + targetPct + '%;height:100%;background:var(--text-muted);opacity:0.4;border-radius:7px;transition:width 0.4s"></div>' +
          '</div>' +
        '</div>' +
      '</div>';

      // Gap analysis
      var gapColor, gapLabel;
      if (Math.abs(gap) < 0.5) {
        gapColor = 'var(--success)';
        gapLabel = 'On target';
      } else if (gap > 0) {
        gapColor = 'var(--info)';
        gapLabel = '+' + gapAbs + 'h surplus';
      } else {
        gapColor = 'var(--danger)';
        gapLabel = '-' + gapAbs + 'h deficit';
      }

      gapHTML += '<div class="flex-between" style="padding:var(--space-sm) 0;border-bottom:1px solid var(--border-subtle)">' +
        '<span>' + c.icon + ' ' + c.name + '</span>' +
        '<span style="color:' + gapColor + ';font-weight:700">' + gapLabel + '</span>' +
      '</div>';

      // Generate insights for large gaps
      if (gap > 1.5) {
        insights.push('You\'re spending <strong>' + gapAbs + ' extra hours</strong> on ' + c.name + ' this week.');
      } else if (gap < -1.5) {
        insights.push(c.name + ' is <strong>' + gapAbs + ' hours below</strong> your target.');
      }
    }

    document.getElementById('bars-container').innerHTML = barsHTML;
    document.getElementById('gap-container').innerHTML = gapHTML || '<p class="text-muted text-sm">Add categories with hour targets in Settings to see gap analysis.</p>';

    // Insights
    if (totalDiff > 0) {
      insights.unshift('Total productive hours are <strong>up ' + totalDiff.toFixed(1) + 'h</strong> compared to last week.');
    } else if (totalDiff < 0) {
      insights.unshift('Total productive hours are <strong>down ' + Math.abs(totalDiff).toFixed(1) + 'h</strong> compared to last week.');
    }

    if (insights.length === 0) {
      insights.push('Start logging focus sessions to get personalized insights about your time allocation.');
    }

    document.getElementById('insight-list').innerHTML = insights.map(function (text) {
      return '<p style="padding:var(--space-sm) 0;border-bottom:1px solid var(--border-subtle);color:var(--text-secondary);font-size:var(--font-size-sm)">&#128161; ' + text + '</p>';
    }).join('');
  }

})();
