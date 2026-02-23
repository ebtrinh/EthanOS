/**
 * EthanOS — Focus Mode (focus.html)
 *
 * Task selector or freeform mode, big countdown timer, "Why this matters" linked goal,
 * Start/Pause/Stop controls, post-session modal (rate difficulty, log distractions, notes),
 * awards +100 XP per session, recent session log table.
 */

(function () {
  'use strict';

  var tasks = [];
  var goals = [];
  var focusSessions = [];
  var categories = [];
  var settings = {};

  // Timer state
  var timerInterval = null;
  var timerRunning = false;
  var timerPaused = false;
  var timerSecondsRemaining = 0;
  var sessionStartTime = null;

  /* ======================================================================
     BOOT
     ====================================================================== */
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(async function () {
      await loadData();
      populateSelectors();
      bindEvents();
      renderSessionLog();
      updateTimerDisplay();
    }, 400);
  });

  async function loadData() {
    tasks = await window.EthanOSData.loadData('tasks', []);
    goals = await window.EthanOSData.loadData('goals', []);
    focusSessions = await window.EthanOSData.loadData('focusSessions', []);
    categories = getAllCategories();
    settings = await window.EthanOSData.loadData('settings', { focusDuration: 25 });
  }

  /* ======================================================================
     SELECTORS
     ====================================================================== */
  function populateSelectors() {
    // Task selector
    var taskSel = document.getElementById('focus-task-select');
    taskSel.innerHTML = '<option value="">Freeform Focus</option>';
    var incomplete = tasks.filter(function (t) { return !t.completed; });
    for (var i = 0; i < incomplete.length; i++) {
      var t = incomplete[i];
      taskSel.innerHTML += '<option value="' + t.id + '">' + escapeHtml(t.title) + '</option>';
    }

    // Category selector
    var catSel = document.getElementById('focus-category-select');
    catSel.innerHTML = '';
    for (var j = 0; j < categories.length; j++) {
      catSel.innerHTML += '<option value="' + categories[j].id + '">' +
        categories[j].icon + ' ' + categories[j].name + '</option>';
    }

    // Duration
    var durInput = document.getElementById('session-duration');
    durInput.value = settings.focusDuration || 25;
    timerSecondsRemaining = (settings.focusDuration || 25) * 60;
    updateTimerDisplay();
  }

  /* ======================================================================
     EVENTS
     ====================================================================== */
  function bindEvents() {
    document.getElementById('start-btn').addEventListener('click', startTimer);
    document.getElementById('pause-btn').addEventListener('click', pauseTimer);
    document.getElementById('stop-btn').addEventListener('click', stopTimer);

    document.getElementById('session-duration').addEventListener('change', function () {
      if (!timerRunning) {
        timerSecondsRemaining = (parseInt(this.value) || 25) * 60;
        updateTimerDisplay();
      }
    });

    document.getElementById('focus-task-select').addEventListener('change', updateWhyMatters);
  }

  /* ======================================================================
     WHY THIS MATTERS
     ====================================================================== */
  function updateWhyMatters() {
    var el = document.getElementById('why-matters');
    var taskId = document.getElementById('focus-task-select').value;

    if (!taskId) {
      el.textContent = '';
      return;
    }

    var task = null;
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i].id === taskId) { task = tasks[i]; break; }
    }
    if (!task) { el.textContent = ''; return; }

    // Find linked goal
    var linkedGoal = null;
    if (task.goalId) {
      for (var j = 0; j < goals.length; j++) {
        if (goals[j].id === task.goalId) { linkedGoal = goals[j]; break; }
      }
    }

    // Also try matching by category
    if (!linkedGoal) {
      for (var k = 0; k < goals.length; k++) {
        if (goals[k].categoryId === task.categoryId) { linkedGoal = goals[k]; break; }
      }
    }

    if (linkedGoal) {
      el.innerHTML = 'This contributes to: <strong class="text-accent">' + escapeHtml(linkedGoal.title) + '</strong>' +
        ' (' + (linkedGoal.progress || 0) + '% complete)';
    } else {
      el.textContent = getCategoryBadgeHTML(task.categoryId) ? '' : '';
      el.innerHTML = 'Category: ' + getCategoryBadgeHTML(task.categoryId);
    }
  }

  /* ======================================================================
     TIMER CONTROLS
     ====================================================================== */
  function startTimer() {
    if (timerPaused) {
      // Resume
      timerPaused = false;
      timerRunning = true;
    } else {
      // Fresh start
      var duration = parseInt(document.getElementById('session-duration').value) || 25;
      timerSecondsRemaining = duration * 60;
      timerRunning = true;
      timerPaused = false;
      sessionStartTime = new Date();
    }

    document.getElementById('start-btn').disabled = true;
    document.getElementById('pause-btn').disabled = false;
    document.getElementById('stop-btn').disabled = false;
    document.getElementById('session-duration').disabled = true;
    document.getElementById('focus-task-select').disabled = true;
    document.getElementById('focus-category-select').disabled = true;

    timerInterval = setInterval(function () {
      timerSecondsRemaining--;
      updateTimerDisplay();

      if (timerSecondsRemaining <= 0) {
        // Timer complete
        clearInterval(timerInterval);
        timerInterval = null;
        timerRunning = false;
        showPostSessionModal();
      }
    }, 1000);
  }

  function pauseTimer() {
    if (!timerRunning) return;
    clearInterval(timerInterval);
    timerInterval = null;
    timerPaused = true;
    timerRunning = false;

    document.getElementById('start-btn').disabled = false;
    document.getElementById('start-btn').textContent = 'Resume';
    document.getElementById('pause-btn').disabled = true;
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;

    if (timerRunning || timerPaused) {
      // Session was interrupted, still log partial session
      showPostSessionModal();
    }

    resetTimerUI();
  }

  function resetTimerUI() {
    timerRunning = false;
    timerPaused = false;
    var duration = parseInt(document.getElementById('session-duration').value) || 25;
    timerSecondsRemaining = duration * 60;
    updateTimerDisplay();

    document.getElementById('start-btn').disabled = false;
    document.getElementById('start-btn').textContent = 'Start';
    document.getElementById('pause-btn').disabled = true;
    document.getElementById('stop-btn').disabled = true;
    document.getElementById('session-duration').disabled = false;
    document.getElementById('focus-task-select').disabled = false;
    document.getElementById('focus-category-select').disabled = false;
  }

  function updateTimerDisplay() {
    var mins = Math.floor(timerSecondsRemaining / 60);
    var secs = timerSecondsRemaining % 60;
    var display = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
    document.getElementById('timer-display').textContent = display;

    // Color change when low
    var el = document.getElementById('timer-display');
    if (timerSecondsRemaining <= 60 && timerRunning) {
      el.style.color = 'var(--danger)';
    } else if (timerSecondsRemaining <= 300 && timerRunning) {
      el.style.color = 'var(--warning)';
    } else {
      el.style.color = 'var(--accent)';
    }
  }

  /* ======================================================================
     POST-SESSION MODAL
     ====================================================================== */
  function showPostSessionModal() {
    var totalDuration = parseInt(document.getElementById('session-duration').value) || 25;
    var elapsed = totalDuration - Math.ceil(timerSecondsRemaining / 60);
    if (elapsed < 1) elapsed = totalDuration;

    var html = '<form id="post-session-form">' +
      '<div class="text-center mb-3">' +
        '<div class="stat-number success" style="font-size:var(--font-size-2xl)">' + elapsed + ' min</div>' +
        '<div class="text-sm text-secondary">Session Duration</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Difficulty Rating (1-5)</label>' +
        '<select id="ps-difficulty">' +
          '<option value="1">1 - Easy</option>' +
          '<option value="2">2 - Moderate</option>' +
          '<option value="3" selected>3 - Normal</option>' +
          '<option value="4">4 - Hard</option>' +
          '<option value="5">5 - Very Hard</option>' +
        '</select>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Distraction Count</label>' +
        '<input type="number" id="ps-distractions" min="0" value="0">' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Notes</label>' +
        '<textarea id="ps-notes" rows="3" placeholder="What did you work on?"></textarea>' +
      '</div>' +
      '<div class="flex gap-1" style="justify-content:flex-end">' +
        '<button type="button" class="btn" onclick="closeModal();window._focusResetUI()">Skip</button>' +
        '<button type="submit" class="btn btn-primary">Save Session</button>' +
      '</div>' +
    '</form>';

    openModal('Session Complete!', html);

    document.getElementById('post-session-form').addEventListener('submit', async function (e) {
      e.preventDefault();

      var taskId = document.getElementById('focus-task-select').value || null;
      var categoryId = document.getElementById('focus-category-select').value;

      // If task selected, use task's category
      if (taskId) {
        for (var i = 0; i < tasks.length; i++) {
          if (tasks[i].id === taskId) {
            categoryId = tasks[i].categoryId;
            break;
          }
        }
      }

      var session = {
        id: generateId(),
        taskId: taskId,
        categoryId: categoryId,
        startTime: sessionStartTime ? sessionStartTime.toISOString() : new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: elapsed,
        difficultyRating: parseInt(document.getElementById('ps-difficulty').value) || 3,
        distractionCount: parseInt(document.getElementById('ps-distractions').value) || 0,
        notes: document.getElementById('ps-notes').value.trim()
      };

      focusSessions.push(session);
      await window.EthanOSData.saveData('focusSessions', focusSessions);

      // Award XP
      await awardXP(100, 'Focus session');

      closeModal();
      resetTimerUI();
      renderSessionLog();
      showToast('Session logged! +100 XP', 'success');
    });
  }

  window._focusResetUI = resetTimerUI;

  /* ======================================================================
     SESSION LOG
     ====================================================================== */
  function renderSessionLog() {
    var container = document.getElementById('session-log');
    var countEl = document.getElementById('session-count');
    if (countEl) countEl.textContent = focusSessions.length + ' sessions';

    if (focusSessions.length === 0) {
      container.innerHTML = '<div class="empty-state">' +
        '<div class="empty-state-icon">&#128293;</div>' +
        '<div class="empty-state-title">No sessions yet</div>' +
        '<div class="empty-state-text">Start a focus session to log your work</div></div>';
      return;
    }

    // Show last 10, newest first
    var recent = focusSessions.slice().reverse().slice(0, 10);

    var html = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">' +
      '<thead><tr style="border-bottom:1px solid var(--border-color)">' +
        '<th class="text-sm text-left" style="padding:var(--space-sm)">Date</th>' +
        '<th class="text-sm text-left" style="padding:var(--space-sm)">Category</th>' +
        '<th class="text-sm text-left" style="padding:var(--space-sm)">Duration</th>' +
        '<th class="text-sm text-left" style="padding:var(--space-sm)">Difficulty</th>' +
        '<th class="text-sm text-left" style="padding:var(--space-sm)">Distractions</th>' +
        '<th class="text-sm text-left" style="padding:var(--space-sm)">Notes</th>' +
      '</tr></thead><tbody>';

    for (var i = 0; i < recent.length; i++) {
      var s = recent[i];
      html += '<tr style="border-bottom:1px solid var(--border-subtle)">' +
        '<td class="text-sm" style="padding:var(--space-sm)">' + timeAgo(s.startTime) + '</td>' +
        '<td style="padding:var(--space-sm)">' + getCategoryBadgeHTML(s.categoryId) + '</td>' +
        '<td class="text-sm" style="padding:var(--space-sm)">' + (s.duration || 0) + 'm</td>' +
        '<td style="padding:var(--space-sm)">' + createStarRating(s.difficultyRating || 0) + '</td>' +
        '<td class="text-sm text-center" style="padding:var(--space-sm)">' + (s.distractionCount || 0) + '</td>' +
        '<td class="text-sm text-muted" style="padding:var(--space-sm);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
          escapeHtml(s.notes || '') + '</td>' +
      '</tr>';
    }

    html += '</tbody></table></div>';
    container.innerHTML = html;
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
