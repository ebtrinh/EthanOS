/**
 * EthanOS — Procrastination Predictor
 * Calculates procrastination risk for upcoming tasks based on multiple factors.
 */
(function () {
  'use strict';

  var tasks = [];
  var focusSessions = [];
  var categories = [];

  /* ========================================================================
     BOOT
     ======================================================================== */
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(init, 350);
  });

  async function init() {
    tasks = await window.EthanOSData.loadData('tasks', []);
    focusSessions = await window.EthanOSData.loadData('focusSessions', []);
    categories = getAllCategories();
    render();
  }

  /* ========================================================================
     RISK CALCULATION
     ======================================================================== */
  function getUpcomingTasks() {
    return tasks.filter(function (t) { return !t.completed; });
  }

  function getCategoryCompletionRate(categoryId) {
    var catTasks = tasks.filter(function (t) { return t.categoryId === categoryId; });
    if (catTasks.length === 0) return 0.5;
    var completed = catTasks.filter(function (t) { return t.completed; }).length;
    return completed / catTasks.length;
  }

  function getOverallCompletionRate() {
    if (tasks.length === 0) return 0.5;
    var completed = tasks.filter(function (t) { return t.completed; }).length;
    return completed / tasks.length;
  }

  function calculateRisk(task) {
    // Factor 1: Difficulty (1-5) - higher = riskier — weight 30%
    var difficultyScore = ((task.difficulty || 3) - 1) / 4; // 0 to 1

    // Factor 2: Deadline distance — further = riskier — weight 25%
    var deadlineScore = 0.5;
    if (task.dueDate) {
      var daysUntil = (new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntil <= 0) deadlineScore = 0.1; // overdue = urgent, low procrastination risk
      else if (daysUntil <= 1) deadlineScore = 0.15;
      else if (daysUntil <= 3) deadlineScore = 0.3;
      else if (daysUntil <= 7) deadlineScore = 0.5;
      else if (daysUntil <= 14) deadlineScore = 0.7;
      else deadlineScore = 0.9;
    }

    // Factor 3: Past completion patterns for category — weight 25%
    var catRate = getCategoryCompletionRate(task.categoryId);
    var categoryScore = 1 - catRate; // lower completion = higher risk

    // Factor 4: Overall completion rate — weight 20%
    var overallRate = getOverallCompletionRate();
    var overallScore = 1 - overallRate;

    var risk = (difficultyScore * 0.30) + (deadlineScore * 0.25) + (categoryScore * 0.25) + (overallScore * 0.20);
    return Math.round(risk * 100);
  }

  function getRiskColor(risk) {
    if (risk <= 33) return 'success';
    if (risk <= 66) return 'warning';
    return 'danger';
  }

  function getRiskLabel(risk) {
    if (risk <= 33) return 'Low';
    if (risk <= 66) return 'Medium';
    return 'High';
  }

  function getTips(task, risk) {
    var tips = [];
    if ((task.difficulty || 3) >= 4) {
      tips.push('Break into smaller chunks — tackle the first part only');
    }
    if (task.dueDate) {
      var daysUntil = (new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntil > 7) {
        tips.push('Start with just 5 minutes to build momentum');
      }
      if (daysUntil <= 1 && daysUntil > 0) {
        tips.push('Due very soon — focus on this now');
      }
    }
    var catRate = getCategoryCompletionRate(task.categoryId);
    if (catRate < 0.5) {
      tips.push('This category has low completion — try pairing it with a reward');
    }
    if (risk > 66) {
      tips.push('High risk — schedule a specific time block for this task');
    }
    if (tips.length === 0) {
      tips.push('You\'re on track — keep the momentum going!');
    }
    return tips;
  }

  /* ========================================================================
     RENDER
     ======================================================================== */
  function render() {
    var upcoming = getUpcomingTasks();
    var risks = upcoming.map(function (t) {
      var risk = calculateRisk(t);
      return { task: t, risk: risk };
    });
    risks.sort(function (a, b) { return b.risk - a.risk; });

    // Weekly score
    var avgRisk = risks.length > 0
      ? Math.round(risks.reduce(function (s, r) { return s + r.risk; }, 0) / risks.length)
      : 0;

    var highCount = risks.filter(function (r) { return r.risk > 66; }).length;
    var lowCount = risks.filter(function (r) { return r.risk <= 33; }).length;

    // Stats row
    document.getElementById('stats-row').innerHTML =
      '<div class="card stat-card">' +
        '<div class="stat-number accent">' + upcoming.length + '</div>' +
        '<div class="stat-label">Upcoming Tasks</div>' +
      '</div>' +
      '<div class="card stat-card">' +
        '<div class="stat-number danger">' + highCount + '</div>' +
        '<div class="stat-label">High Risk</div>' +
      '</div>' +
      '<div class="card stat-card">' +
        '<div class="stat-number success">' + lowCount + '</div>' +
        '<div class="stat-label">Low Risk</div>' +
      '</div>' +
      '<div class="card stat-card">' +
        '<div class="stat-number ' + getRiskColor(avgRisk) + '">' + Math.round(getOverallCompletionRate() * 100) + '%</div>' +
        '<div class="stat-label">Completion Rate</div>' +
      '</div>';

    // Weekly score card
    var scoreColor = getRiskColor(avgRisk);
    document.getElementById('weekly-score-badge').className = 'badge badge-' + scoreColor;
    document.getElementById('weekly-score-badge').textContent = avgRisk + '% — ' + getRiskLabel(avgRisk);
    document.getElementById('weekly-score-bar').innerHTML = createProgressBar(avgRisk, scoreColor);
    document.getElementById('weekly-score-text').textContent = avgRisk <= 33
      ? 'Great discipline this week! Keep it up.'
      : avgRisk <= 66
        ? 'Moderate risk — watch out for the harder tasks.'
        : 'High procrastination risk — consider breaking tasks into smaller pieces.';

    // Task count
    document.getElementById('task-count').textContent = upcoming.length + ' task' + (upcoming.length !== 1 ? 's' : '');

    // Task list
    var listEl = document.getElementById('task-list');
    if (risks.length === 0) {
      listEl.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon">&#9203;</div>' +
          '<div class="empty-state-title">No upcoming tasks</div>' +
          '<div class="empty-state-text">Add tasks in the Academic Brain page to see procrastination predictions.</div>' +
        '</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < risks.length; i++) {
      var item = risks[i];
      var t = item.task;
      var risk = item.risk;
      var color = getRiskColor(risk);
      var tips = getTips(t, risk);
      var dueDateStr = t.dueDate ? formatDate(t.dueDate) : 'No deadline';
      var daysUntil = t.dueDate
        ? Math.ceil((new Date(t.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;
      var dueLabel = '';
      if (daysUntil !== null) {
        if (daysUntil < 0) dueLabel = '<span class="badge badge-danger">Overdue</span>';
        else if (daysUntil <= 1) dueLabel = '<span class="badge badge-warning">Due today</span>';
        else if (daysUntil <= 3) dueLabel = '<span class="badge badge-warning">Due soon</span>';
      }

      html += '<div class="list-item" style="align-items:flex-start;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:200px">' +
          '<div class="flex items-center gap-1 mb-1">' +
            '<strong>' + (t.title || 'Untitled') + '</strong> ' +
            getCategoryBadgeHTML(t.categoryId) + ' ' + dueLabel +
          '</div>' +
          '<div class="flex items-center gap-2 text-sm text-secondary">' +
            '<span>' + dueDateStr + '</span>' +
            '<span>' + createStarRating(t.difficulty || 1) + '</span>' +
            (t.estimatedMinutes ? '<span>' + t.estimatedMinutes + ' min</span>' : '') +
          '</div>' +
          '<div class="note-tags mt-1">' +
            tips.map(function (tip) { return '<span class="tag-pill" style="background:var(--' + color + '-bg,var(--bg-primary));color:var(--' + color + ',var(--text-secondary))">&#128161; ' + tip + '</span>'; }).join('') +
          '</div>' +
        '</div>' +
        '<div style="text-align:center;min-width:90px">' +
          '<div class="stat-number ' + color + '" style="font-size:var(--font-size-xl)">' + risk + '%</div>' +
          '<div class="text-xs text-muted">' + getRiskLabel(risk) + ' Risk</div>' +
          '<div style="margin-top:var(--space-xs)">' + createProgressBar(risk, color) + '</div>' +
        '</div>' +
      '</div>';
    }
    listEl.innerHTML = html;
  }

})();
