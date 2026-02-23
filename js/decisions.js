/**
 * EthanOS — Decision Simulator
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

  var tasks = await window.EthanOSData.loadData('tasks', []);
  var goals = await window.EthanOSData.loadData('goals', []);
  var categories = getAllCategories();
  var schedule = await window.EthanOSData.loadData('schedule', []);

  // ---- Tab Switching ----
  var tabBtns = document.querySelectorAll('#decision-tabs .tab');
  var tabSkip = document.getElementById('tab-skip');
  var tabHours = document.getElementById('tab-hours');

  for (var i = 0; i < tabBtns.length; i++) {
    tabBtns[i].addEventListener('click', function () {
      for (var j = 0; j < tabBtns.length; j++) tabBtns[j].classList.remove('active');
      this.classList.add('active');
      var t = this.getAttribute('data-tab');
      tabSkip.classList.toggle('hidden', t !== 'skip');
      tabHours.classList.toggle('hidden', t !== 'hours');
    });
  }

  // ---- Populate Task Selector ----
  var skipSelect = document.getElementById('skip-task-select');
  var incompleteTasks = tasks.filter(function (t) { return !t.completed; });
  for (var ti = 0; ti < incompleteTasks.length; ti++) {
    var opt = document.createElement('option');
    opt.value = incompleteTasks[ti].id;
    opt.textContent = incompleteTasks[ti].title;
    skipSelect.appendChild(opt);
  }

  // ---- Populate Category Selector ----
  var catSelect = document.getElementById('hours-cat-select');
  for (var ci = 0; ci < categories.length; ci++) {
    var cOpt = document.createElement('option');
    cOpt.value = categories[ci].id;
    cOpt.textContent = categories[ci].icon + ' ' + categories[ci].name;
    catSelect.appendChild(cOpt);
  }

  // ---- Skip Task Analysis ----
  skipSelect.addEventListener('change', function () {
    var taskId = this.value;
    var resultsEl = document.getElementById('skip-results');
    if (!taskId) { resultsEl.innerHTML = ''; return; }

    var task = null;
    for (var t = 0; t < tasks.length; t++) {
      if (tasks[t].id === taskId) { task = tasks[t]; break; }
    }
    if (!task) return;

    // Stress impact
    var stressScore = 0;
    stressScore += (task.difficulty || 3) * 2; // higher difficulty = more stress from skipping
    if (task.dueDate) {
      var daysUntil = Math.ceil((new Date(task.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntil < 0) stressScore += 10;
      else if (daysUntil < 2) stressScore += 8;
      else if (daysUntil < 7) stressScore += 4;
      else stressScore += 1;
    }
    stressScore = Math.min(10, stressScore);
    var stressColor = stressScore <= 3 ? 'success' : stressScore <= 6 ? 'warning' : 'danger';

    // Goal delay
    var goalDelay = 'No linked goal';
    if (task.goalId) {
      var linkedGoal = null;
      for (var g = 0; g < goals.length; g++) {
        if (goals[g].id === task.goalId) { linkedGoal = goals[g]; break; }
      }
      if (linkedGoal) {
        var estMinutes = task.estimatedMinutes || 30;
        var weeksDelay = (estMinutes / 60) / (linkedGoal.weeklyHours || 1);
        goalDelay = 'Delays "' + linkedGoal.title + '" by ~' + weeksDelay.toFixed(1) + ' week(s)';
      }
    }

    // Overdue risk
    var overdueRisk = 'Low';
    var overdueColor = 'success';
    if (task.dueDate) {
      var dLeft = Math.ceil((new Date(task.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
      if (dLeft < 0) { overdueRisk = 'Already overdue!'; overdueColor = 'danger'; }
      else if (dLeft < 2) { overdueRisk = 'Very High — due in ' + dLeft + ' day(s)'; overdueColor = 'danger'; }
      else if (dLeft < 5) { overdueRisk = 'Medium — due in ' + dLeft + ' days'; overdueColor = 'warning'; }
      else { overdueRisk = 'Low — due in ' + dLeft + ' days'; overdueColor = 'success'; }
    }

    resultsEl.innerHTML =
      '<div class="card"><div class="card-header"><h3 class="card-title">Stress Impact</h3></div><div class="card-body">' +
        '<div class="stat-number ' + stressColor + '" style="font-size:var(--font-size-2xl)">' + stressScore + '/10</div>' +
        '<div class="mt-2">' + createProgressBar(stressScore * 10, stressColor) + '</div>' +
      '</div></div>' +
      '<div class="card"><div class="card-header"><h3 class="card-title">Goal Delay</h3></div><div class="card-body">' +
        '<p style="font-size:var(--font-size-md)">' + goalDelay + '</p>' +
      '</div></div>' +
      '<div class="card"><div class="card-header"><h3 class="card-title">Overdue Risk</h3></div><div class="card-body">' +
        '<span class="badge badge-lg badge-' + overdueColor + '">' + overdueRisk + '</span>' +
      '</div></div>';
  });

  // ---- Add Hours Analysis ----
  function analyzeHours() {
    var catId = catSelect.value;
    var extraHours = parseFloat(document.getElementById('hours-input').value) || 0;
    var resultsEl = document.getElementById('hours-results');
    if (!catId || extraHours <= 0) { resultsEl.innerHTML = ''; return; }

    var cat = getCategoryById(catId);
    if (!cat) return;

    // Goal acceleration
    var catGoals = goals.filter(function (g) { return g.categoryId === catId; });
    var accelHTML = '';
    if (catGoals.length === 0) {
      accelHTML = '<p class="text-muted">No goals in this category.</p>';
    } else {
      for (var g = 0; g < catGoals.length; g++) {
        var goal = catGoals[g];
        var currentWeekly = goal.weeklyHours || 1;
        var newWeekly = currentWeekly + extraHours;
        var remaining = 100 - (goal.progress || 0);
        var currentWeeksLeft = remaining > 0 ? (remaining / (currentWeekly * (100 / 52))) : 0;
        var newWeeksLeft = remaining > 0 ? (remaining / (newWeekly * (100 / 52))) : 0;
        var saved = Math.max(0, currentWeeksLeft - newWeeksLeft);
        accelHTML += '<div class="list-item"><span>' + goal.title + ': <strong class="text-success">~' + saved.toFixed(1) + ' weeks faster</strong></span></div>';
      }
    }

    // Time trade-offs
    var totalTarget = 0;
    for (var c = 0; c < categories.length; c++) totalTarget += categories[c].weeklyHoursTarget || 0;
    var totalAvailable = 112; // ~16h/day * 7
    var freeHours = totalAvailable - totalTarget;
    var tradeoffHTML = '';
    if (extraHours <= freeHours) {
      tradeoffHTML = '<p class="text-success">You have ~' + freeHours.toFixed(0) + 'h of unallocated time. This fits comfortably.</p>';
    } else {
      var deficit = extraHours - freeHours;
      tradeoffHTML = '<p class="text-warning">This exceeds your free time by ~' + deficit.toFixed(1) + 'h. Other categories would need to lose time:</p>';
      var otherCats = categories.filter(function (oc) { return oc.id !== catId; });
      var perCatLoss = deficit / Math.max(otherCats.length, 1);
      for (var o = 0; o < otherCats.length; o++) {
        tradeoffHTML += '<div class="list-item"><span>' + otherCats[o].icon + ' ' + otherCats[o].name + ': <strong class="text-danger">-' + perCatLoss.toFixed(1) + 'h/week</strong></span></div>';
      }
    }

    // New schedule load
    var newTotal = totalTarget + extraHours;
    var loadPct = Math.round((newTotal / totalAvailable) * 100);
    var loadColor = loadPct < 70 ? 'success' : loadPct < 85 ? 'warning' : 'danger';

    resultsEl.innerHTML =
      '<div class="card"><div class="card-header"><h3 class="card-title">Goal Acceleration</h3></div><div class="card-body">' + accelHTML + '</div></div>' +
      '<div class="card"><div class="card-header"><h3 class="card-title">Time Trade-offs</h3></div><div class="card-body">' + tradeoffHTML + '</div></div>' +
      '<div class="card"><div class="card-header"><h3 class="card-title">Schedule Load</h3></div><div class="card-body">' +
        '<div class="stat-number ' + loadColor + '" style="font-size:var(--font-size-2xl)">' + loadPct + '%</div>' +
        '<div class="mt-2">' + createProgressBar(loadPct, loadColor) + '</div>' +
        '<div class="text-sm text-secondary mt-1">' + newTotal.toFixed(0) + 'h / ' + totalAvailable + 'h weekly capacity</div>' +
      '</div></div>';
  }

  catSelect.addEventListener('change', analyzeHours);
  document.getElementById('hours-input').addEventListener('input', analyzeHours);

})();
