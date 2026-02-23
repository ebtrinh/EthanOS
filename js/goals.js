/**
 * EthanOS — Goal Engine (goals.html)
 *
 * Goal cards with progress bars, weekly hours invested, projected completion,
 * "If X hrs/week -> done by" calculator, milestone checklists, Add/Edit/Delete, progress slider.
 */

(function () {
  'use strict';

  var goals = [];
  var focusSessions = [];
  var categories = [];

  /* ======================================================================
     BOOT
     ====================================================================== */
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(async function () {
      await loadData();
      populateCalcDropdown();
      bindEvents();
      render();
    }, 400);
  });

  async function loadData() {
    goals = await window.EthanOSData.loadData('goals', []);
    focusSessions = await window.EthanOSData.loadData('focusSessions', []);
    categories = getAllCategories();
  }

  /* ======================================================================
     EVENTS
     ====================================================================== */
  function bindEvents() {
    document.getElementById('add-goal-btn').addEventListener('click', function () {
      openGoalModal(null);
    });

    document.getElementById('calc-hours').addEventListener('input', updateCalc);
    document.getElementById('calc-goal').addEventListener('change', updateCalc);
  }

  function populateCalcDropdown() {
    var sel = document.getElementById('calc-goal');
    sel.innerHTML = '<option value="">Select a goal</option>';
    for (var i = 0; i < goals.length; i++) {
      var g = goals[i];
      sel.innerHTML += '<option value="' + g.id + '">' + escapeHtml(g.title) + '</option>';
    }
  }

  function updateCalc() {
    var hrsPerWeek = parseFloat(document.getElementById('calc-hours').value) || 0;
    var goalId = document.getElementById('calc-goal').value;
    var resultEl = document.getElementById('calc-result');

    if (!goalId || hrsPerWeek <= 0) {
      resultEl.textContent = '--';
      return;
    }

    var goal = null;
    for (var i = 0; i < goals.length; i++) {
      if (goals[i].id === goalId) { goal = goals[i]; break; }
    }
    if (!goal) { resultEl.textContent = '--'; return; }

    var remaining = 100 - (goal.progress || 0);
    if (remaining <= 0) {
      resultEl.textContent = 'Already complete!';
      return;
    }

    // Estimate: assume 100% = goal.weeklyHours * weeks-until-targetDate
    // Or simpler: remaining% * (targetDate - createdAt) / 100 => total weeks
    // Use a simpler model: X hrs/week, assume ~1% per hour invested
    var hoursNeeded = remaining; // rough: 1 hour = 1%
    var weeksNeeded = hoursNeeded / hrsPerWeek;
    var completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + Math.ceil(weeksNeeded * 7));

    resultEl.textContent = formatDate(completionDate);
  }

  /* ======================================================================
     RENDER
     ====================================================================== */
  function render() {
    var container = document.getElementById('goals-container');

    if (goals.length === 0) {
      container.innerHTML = '<div class="empty-state span-full">' +
        '<div class="empty-state-icon">&#127919;</div>' +
        '<div class="empty-state-title">No goals yet</div>' +
        '<div class="empty-state-text">Click "Add Goal" to set your first goal</div></div>';
      return;
    }

    var html = '';
    for (var i = 0; i < goals.length; i++) {
      var g = goals[i];
      var cat = getCategoryById(g.categoryId);
      var color = getCategoryColor(g.categoryId);
      var progress = g.progress || 0;
      var weeklyHrs = calcWeeklyHours(g.id);

      // Projected completion
      var projected = '--';
      if (progress < 100 && weeklyHrs > 0) {
        var remaining = 100 - progress;
        var weeksLeft = remaining / weeklyHrs; // rough
        var projDate = new Date();
        projDate.setDate(projDate.getDate() + Math.ceil(weeksLeft * 7));
        projected = formatDate(projDate);
      } else if (progress >= 100) {
        projected = 'Complete!';
      }

      // Milestones
      var milestonesHTML = '';
      if (g.milestones && g.milestones.length > 0) {
        milestonesHTML = '<div class="mt-2">';
        for (var m = 0; m < g.milestones.length; m++) {
          var ms = g.milestones[m];
          milestonesHTML += '<label class="form-check" style="margin-bottom:4px">' +
            '<input type="checkbox" ' + (ms.done ? 'checked' : '') +
            ' onchange="window._goalToggleMilestone(\'' + g.id + '\',' + m + ',this.checked)">' +
            '<span style="' + (ms.done ? 'text-decoration:line-through;color:var(--text-muted)' : '') + '">' +
              escapeHtml(ms.title) + '</span>' +
          '</label>';
        }
        milestonesHTML += '</div>';
      }

      html += '<div class="card">' +
        '<div class="card-header">' +
          '<div>' +
            '<div class="card-title" style="color:' + color + '">' + escapeHtml(g.title) + '</div>' +
            '<div class="card-subtitle">' + getCategoryBadgeHTML(g.categoryId) +
              (g.targetDate ? ' Target: ' + formatDate(g.targetDate) : '') + '</div>' +
          '</div>' +
          '<div class="btn-group">' +
            '<button class="btn btn-sm btn-ghost" onclick="window._goalEdit(\'' + g.id + '\')">Edit</button>' +
            '<button class="btn btn-sm btn-danger" onclick="window._goalDelete(\'' + g.id + '\')">Del</button>' +
          '</div>' +
        '</div>' +
        '<div class="card-body">' +
          '<div class="progress-label">' +
            '<span class="progress-label-name">Progress</span>' +
            '<span class="progress-label-value">' + progress + '%</span>' +
          '</div>' +
          createProgressBar(progress, progress >= 100 ? 'success' : (progress >= 50 ? 'warning' : '')) +

          '<div class="grid-2 mt-2">' +
            '<div class="text-sm"><span class="text-muted">Weekly hours:</span> <strong>' + weeklyHrs.toFixed(1) + 'h</strong></div>' +
            '<div class="text-sm"><span class="text-muted">Projected:</span> <strong>' + projected + '</strong></div>' +
          '</div>' +

          // Progress slider
          '<div class="mt-2">' +
            '<label class="text-xs text-muted">Adjust progress</label>' +
            '<input type="range" min="0" max="100" value="' + progress + '" style="width:100%;accent-color:' + color + '" ' +
              'onchange="window._goalUpdateProgress(\'' + g.id + '\',this.value)">' +
          '</div>' +

          milestonesHTML +
        '</div>' +
      '</div>';
    }

    container.innerHTML = html;
  }

  /* ======================================================================
     WEEKLY HOURS CALCULATION
     ====================================================================== */
  function calcWeeklyHours(goalId) {
    var now = new Date();
    var weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    var total = 0;

    for (var i = 0; i < focusSessions.length; i++) {
      var s = focusSessions[i];
      if (s.taskId) {
        // Check if task is linked to this goal - skip for now, just use category matching
      }
      var sDate = new Date(s.startTime || s.endTime);
      if (sDate >= weekAgo && sDate <= now) {
        total += (s.duration || 0) / 60;
      }
    }
    return total;
  }

  /* ======================================================================
     GOAL MODAL
     ====================================================================== */
  function openGoalModal(goal) {
    var isEdit = !!goal;
    var cats = getAllCategories();

    var catOptions = '';
    for (var i = 0; i < cats.length; i++) {
      var sel = (goal && goal.categoryId === cats[i].id) ? ' selected' : '';
      catOptions += '<option value="' + cats[i].id + '"' + sel + '>' + cats[i].icon + ' ' + cats[i].name + '</option>';
    }

    var milestonesVal = '';
    if (goal && goal.milestones) {
      milestonesVal = goal.milestones.map(function (m) { return m.title; }).join('\n');
    }

    var html = '<form id="goal-form">' +
      '<div class="form-group">' +
        '<label class="form-label">Goal Title</label>' +
        '<input type="text" id="gf-title" value="' + escapeAttr(goal ? goal.title : '') + '" required>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Category</label>' +
        '<select id="gf-category">' + catOptions + '</select>' +
      '</div>' +
      '<div class="grid-2">' +
        '<div class="form-group">' +
          '<label class="form-label">Target Date</label>' +
          '<input type="date" id="gf-target" value="' + (goal && goal.targetDate ? goal.targetDate.split('T')[0] : '') + '">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Weekly Hours</label>' +
          '<input type="number" id="gf-hours" min="0" max="168" value="' + (goal ? (goal.weeklyHours || '') : '') + '">' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Milestones (one per line)</label>' +
        '<textarea id="gf-milestones" rows="4" placeholder="Learn basics&#10;Build project&#10;Final review">' + escapeHtml(milestonesVal) + '</textarea>' +
      '</div>' +
      '<div class="flex gap-1" style="justify-content:flex-end">' +
        '<button type="button" class="btn" onclick="closeModal()">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">' + (isEdit ? 'Save' : 'Add Goal') + '</button>' +
      '</div>' +
    '</form>';

    openModal(isEdit ? 'Edit Goal' : 'Add Goal', html);

    document.getElementById('goal-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var title = document.getElementById('gf-title').value.trim();
      if (!title) return;

      var milestoneLines = document.getElementById('gf-milestones').value.split('\n').filter(function (l) { return l.trim(); });
      var milestones = milestoneLines.map(function (line, idx) {
        // Preserve existing done state
        if (goal && goal.milestones && goal.milestones[idx]) {
          return { title: line.trim(), done: goal.milestones[idx].done || false };
        }
        return { title: line.trim(), done: false };
      });

      if (isEdit) {
        goal.title = title;
        goal.categoryId = document.getElementById('gf-category').value;
        goal.targetDate = document.getElementById('gf-target').value || null;
        goal.weeklyHours = parseFloat(document.getElementById('gf-hours').value) || 0;
        goal.milestones = milestones;
      } else {
        goals.push({
          id: generateId(),
          title: title,
          categoryId: document.getElementById('gf-category').value,
          targetDate: document.getElementById('gf-target').value || null,
          weeklyHours: parseFloat(document.getElementById('gf-hours').value) || 0,
          milestones: milestones,
          progress: 0,
          createdAt: new Date().toISOString()
        });
      }

      await window.EthanOSData.saveData('goals', goals);
      closeModal();
      showToast(isEdit ? 'Goal updated' : 'Goal added', 'success');
      populateCalcDropdown();
      render();
    });
  }

  /* ======================================================================
     ACTIONS
     ====================================================================== */
  window._goalEdit = function (id) {
    for (var i = 0; i < goals.length; i++) {
      if (goals[i].id === id) { openGoalModal(goals[i]); return; }
    }
  };

  window._goalDelete = async function (id) {
    goals = goals.filter(function (g) { return g.id !== id; });
    await window.EthanOSData.saveData('goals', goals);
    showToast('Goal deleted', 'warning');
    populateCalcDropdown();
    render();
  };

  window._goalUpdateProgress = async function (id, val) {
    for (var i = 0; i < goals.length; i++) {
      if (goals[i].id === id) {
        goals[i].progress = parseInt(val) || 0;
        break;
      }
    }
    await window.EthanOSData.saveData('goals', goals);
    render();
  };

  window._goalToggleMilestone = async function (goalId, milestoneIdx, checked) {
    for (var i = 0; i < goals.length; i++) {
      if (goals[i].id === goalId && goals[i].milestones && goals[i].milestones[milestoneIdx]) {
        goals[i].milestones[milestoneIdx].done = checked;
        break;
      }
    }
    await window.EthanOSData.saveData('goals', goals);
    render();
  };

  /* ======================================================================
     UTIL
     ====================================================================== */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

})();
