/**
 * EthanOS — Performance Analytics (analytics.html)
 *
 * Hours by category (CSS horizontal bars), planned vs actual,
 * deep work stats, GitHub-style 12-week activity heatmap, category breakdown.
 */

(function () {
  'use strict';

  var focusSessions = [];
  var categories = [];
  var schedule = [];

  /* ======================================================================
     BOOT
     ====================================================================== */
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(async function () {
      await loadData();
      render();
    }, 400);
  });

  async function loadData() {
    focusSessions = await window.EthanOSData.loadData('focusSessions', []);
    categories = getAllCategories();
    schedule = await window.EthanOSData.loadData('schedule', []);
  }

  /* ======================================================================
     RENDER
     ====================================================================== */
  function render() {
    renderStats();
    renderCategoryBars();
    renderPlannedVsActual();
    renderCategoryBreakdown();
    renderHeatmap();
  }

  /* ======================================================================
     DEEP WORK STATS
     ====================================================================== */
  function renderStats() {
    var totalSessions = focusSessions.length;
    var totalMinutes = 0;
    var totalDistractions = 0;

    for (var i = 0; i < focusSessions.length; i++) {
      totalMinutes += (focusSessions[i].duration || 0);
      totalDistractions += (focusSessions[i].distractionCount || 0);
    }

    var avgDuration = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;
    var avgDistractions = totalSessions > 0 ? (totalDistractions / totalSessions).toFixed(1) : 0;

    document.getElementById('total-sessions').textContent = totalSessions;
    document.getElementById('total-focus-hours').textContent = (totalMinutes / 60).toFixed(1) + 'h';
    document.getElementById('avg-session').textContent = avgDuration + 'm';
    document.getElementById('avg-distractions').textContent = avgDistractions;
  }

  /* ======================================================================
     HOURS BY CATEGORY — horizontal bar chart
     ====================================================================== */
  function renderCategoryBars() {
    var container = document.getElementById('category-bars');
    var hoursByCategory = {};

    for (var i = 0; i < focusSessions.length; i++) {
      var s = focusSessions[i];
      var catId = s.categoryId || 'unknown';
      if (!hoursByCategory[catId]) hoursByCategory[catId] = 0;
      hoursByCategory[catId] += (s.duration || 0) / 60;
    }

    var catIds = Object.keys(hoursByCategory);
    if (catIds.length === 0) {
      container.innerHTML = '<div class="empty-state">' +
        '<div class="empty-state-icon">&#128200;</div>' +
        '<div class="empty-state-title">No data yet</div>' +
        '<div class="empty-state-text">Complete focus sessions to see analytics</div></div>';
      return;
    }

    // Find max
    var maxHours = 0;
    for (var j = 0; j < catIds.length; j++) {
      if (hoursByCategory[catIds[j]] > maxHours) maxHours = hoursByCategory[catIds[j]];
    }

    var html = '';
    for (var k = 0; k < catIds.length; k++) {
      var catId = catIds[k];
      var hours = hoursByCategory[catId];
      var pct = maxHours > 0 ? (hours / maxHours) * 100 : 0;
      var cat = getCategoryById(catId);
      var color = getCategoryColor(catId);
      var name = cat ? cat.icon + ' ' + cat.name : catId;

      html += '<div style="margin-bottom:var(--space-md)">' +
        '<div class="flex-between text-sm mb-1">' +
          '<span>' + name + '</span>' +
          '<span class="text-muted">' + hours.toFixed(1) + 'h</span>' +
        '</div>' +
        '<div style="height:8px;background:var(--bg-primary);border-radius:4px;overflow:hidden">' +
          '<div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:4px;transition:width 0.4s ease"></div>' +
        '</div>' +
      '</div>';
    }
    container.innerHTML = html;
  }

  /* ======================================================================
     PLANNED VS ACTUAL
     ====================================================================== */
  function renderPlannedVsActual() {
    var container = document.getElementById('planned-vs-actual');

    // Planned = category weeklyHoursTarget, Actual = focus session hours this week
    var now = new Date();
    var weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    var actualByCategory = {};
    for (var i = 0; i < focusSessions.length; i++) {
      var s = focusSessions[i];
      var sDate = new Date(s.startTime || s.endTime);
      if (sDate >= weekAgo && sDate <= now) {
        var catId = s.categoryId || 'unknown';
        if (!actualByCategory[catId]) actualByCategory[catId] = 0;
        actualByCategory[catId] += (s.duration || 0) / 60;
      }
    }

    if (categories.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-title">No categories</div></div>';
      return;
    }

    var html = '';
    for (var j = 0; j < categories.length; j++) {
      var cat = categories[j];
      var planned = cat.weeklyHoursTarget || 0;
      var actual = actualByCategory[cat.id] || 0;
      var color = getCategoryColor(cat.id);
      var maxVal = Math.max(planned, actual, 1);
      var plannedPct = (planned / maxVal) * 100;
      var actualPct = (actual / maxVal) * 100;

      html += '<div style="margin-bottom:var(--space-md)">' +
        '<div class="flex-between text-sm mb-1">' +
          '<span>' + cat.icon + ' ' + cat.name + '</span>' +
          '<span class="text-muted">' + actual.toFixed(1) + 'h / ' + planned + 'h</span>' +
        '</div>' +
        '<div style="position:relative;height:16px;background:var(--bg-primary);border-radius:4px;overflow:hidden">' +
          '<div style="position:absolute;height:100%;width:' + plannedPct + '%;background:' + color + '33;border-radius:4px" title="Planned"></div>' +
          '<div style="position:absolute;height:100%;width:' + actualPct + '%;background:' + color + ';border-radius:4px" title="Actual"></div>' +
        '</div>' +
      '</div>';
    }

    html += '<div class="flex gap-2 mt-2 text-xs text-muted">' +
      '<span><span style="display:inline-block;width:12px;height:8px;border-radius:2px;background:var(--accent)33"></span> Planned</span>' +
      '<span><span style="display:inline-block;width:12px;height:8px;border-radius:2px;background:var(--accent)"></span> Actual</span>' +
    '</div>';

    container.innerHTML = html;
  }

  /* ======================================================================
     CATEGORY BREAKDOWN
     ====================================================================== */
  function renderCategoryBreakdown() {
    var container = document.getElementById('category-breakdown');
    var total = 0;
    var hoursByCategory = {};

    for (var i = 0; i < focusSessions.length; i++) {
      var s = focusSessions[i];
      var catId = s.categoryId || 'unknown';
      var dur = (s.duration || 0) / 60;
      hoursByCategory[catId] = (hoursByCategory[catId] || 0) + dur;
      total += dur;
    }

    if (total === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">&#128202;</div><div class="empty-state-title">No data yet</div></div>';
      return;
    }

    var html = '';
    var catIds = Object.keys(hoursByCategory);
    catIds.sort(function (a, b) { return hoursByCategory[b] - hoursByCategory[a]; });

    for (var j = 0; j < catIds.length; j++) {
      var catId = catIds[j];
      var hours = hoursByCategory[catId];
      var pct = ((hours / total) * 100).toFixed(1);
      var cat = getCategoryById(catId);
      var color = getCategoryColor(catId);
      var name = cat ? cat.icon + ' ' + cat.name : catId;

      html += '<div class="list-item">' +
        '<div style="width:12px;height:12px;border-radius:50%;background:' + color + ';flex-shrink:0"></div>' +
        '<div class="flex-1">' +
          '<div class="text-sm font-bold">' + name + '</div>' +
          '<div class="text-xs text-muted">' + hours.toFixed(1) + 'h</div>' +
        '</div>' +
        '<span class="badge" style="background:' + color + '22;color:' + color + '">' + pct + '%</span>' +
      '</div>';
    }
    container.innerHTML = html;
  }

  /* ======================================================================
     ACTIVITY HEATMAP — 12 weeks (84 days)
     ====================================================================== */
  function renderHeatmap() {
    var grid = document.getElementById('heatmap-grid');
    if (!grid) return;

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    // Count sessions per day
    var sessionsByDay = {};
    for (var i = 0; i < focusSessions.length; i++) {
      var s = focusSessions[i];
      var d = new Date(s.startTime || s.endTime);
      var key = d.toISOString().split('T')[0];
      sessionsByDay[key] = (sessionsByDay[key] || 0) + 1;
    }

    // Build 12 weeks * 7 days = 84 cells
    var html = '';
    // Grid: 12 columns (weeks) x 7 rows (days)
    grid.style.gridTemplateColumns = 'repeat(12, 1fr)';
    grid.style.gridTemplateRows = 'repeat(7, 1fr)';

    for (var row = 0; row < 7; row++) {
      for (var col = 0; col < 12; col++) {
        var daysAgo = (11 - col) * 7 + (6 - row);
        var date = new Date(today);
        date.setDate(date.getDate() - daysAgo);
        var key = date.toISOString().split('T')[0];
        var count = sessionsByDay[key] || 0;

        var level = 0;
        if (count >= 5) level = 5;
        else if (count >= 4) level = 4;
        else if (count >= 3) level = 3;
        else if (count >= 2) level = 2;
        else if (count >= 1) level = 1;

        html += '<div class="heatmap-cell level-' + level + '" title="' + key + ': ' + count + ' session' + (count !== 1 ? 's' : '') + '"></div>';
      }
    }

    grid.innerHTML = html;
  }

})();
