/**
 * EthanOS — XP & Competitive
 * Level display, XP progress, achievements, and weekly comparison.
 */
(function () {
  'use strict';

  var xpData = {};
  var tasks = [];
  var focusSessions = [];
  var moodEntries = [];

  /* Level thresholds (mirrored from shared.js) */
  var LEVELS = [
    { xp: 0,     name: 'Beginner',    icon: '&#128105;&#8205;&#128187;' },
    { xp: 500,   name: 'Novice',      icon: '&#129299;' },
    { xp: 1500,  name: 'Apprentice',  icon: '&#9876;&#65039;' },
    { xp: 3000,  name: 'Journeyman',  icon: '&#128170;' },
    { xp: 5000,  name: 'Expert',      icon: '&#127775;' },
    { xp: 8000,  name: 'Master',      icon: '&#128081;' },
    { xp: 12000, name: 'Legend',       icon: '&#127942;' }
  ];

  /* Achievement definitions */
  var ACHIEVEMENTS = [
    { id: 'first_focus',     name: 'First Focus',     desc: 'Complete 1 focus session',        icon: '&#128293;', check: function () { return focusSessions.length >= 1; } },
    { id: 'task_master_10',  name: 'Task Master',      desc: 'Complete 10 tasks',               icon: '&#9989;',  check: function () { return tasks.filter(function(t){return t.completed;}).length >= 10; } },
    { id: 'week_warrior',    name: 'Week Warrior',     desc: '7-day check-in streak',           icon: '&#128170;', check: function () { return getCheckinStreak() >= 7; } },
    { id: 'deep_worker',     name: 'Deep Worker',      desc: 'Complete 10 focus sessions',      icon: '&#129504;', check: function () { return focusSessions.length >= 10; } },
    { id: 'centurion',       name: 'Centurion',        desc: 'Complete 100 tasks',              icon: '&#127942;', check: function () { return tasks.filter(function(t){return t.completed;}).length >= 100; } },
    { id: 'note_taker',      name: 'Note Taker',       desc: 'Create 5 notes',                  icon: '&#128221;', check: function () { return (xpData._noteCount || 0) >= 5; } },
    { id: 'xp_500',          name: 'Getting Started',  desc: 'Earn 500 XP total',               icon: '&#11088;',  check: function () { return (xpData.totalXp || 0) >= 500; } },
    { id: 'xp_5000',         name: 'High Achiever',    desc: 'Earn 5000 XP total',              icon: '&#127775;', check: function () { return (xpData.totalXp || 0) >= 5000; } }
  ];

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(init, 350);
  });

  async function init() {
    xpData = await window.EthanOSData.loadData('xp', {
      totalXp: 0, level: 'Beginner', weeklyScores: [], streaks: {}, achievements: []
    });
    tasks = await window.EthanOSData.loadData('tasks', []);
    focusSessions = await window.EthanOSData.loadData('focusSessions', []);
    moodEntries = await window.EthanOSData.loadData('moodEntries', []);

    // Count notes for achievement
    var notesData = await window.EthanOSData.loadData('notes', []);
    xpData._noteCount = notesData.length;

    await checkAndAwardAchievements();
    render();
  }

  /* ========================================================================
     HELPERS
     ======================================================================== */
  function getCurrentLevel(totalXp) {
    var level = LEVELS[0];
    var next = LEVELS[1] || null;
    for (var i = LEVELS.length - 1; i >= 0; i--) {
      if (totalXp >= LEVELS[i].xp) {
        level = LEVELS[i];
        next = LEVELS[i + 1] || null;
        break;
      }
    }
    return { current: level, next: next };
  }

  function getWeekStart(date) {
    var d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function getCheckinStreak() {
    if (moodEntries.length === 0) return 0;
    var sorted = moodEntries.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    var streak = 0;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var check = new Date(today);

    for (var i = 0; i < 365; i++) {
      var dateStr = check.toISOString().split('T')[0];
      var found = false;
      for (var j = 0; j < sorted.length; j++) {
        if (sorted[j].date && sorted[j].date.indexOf(dateStr) === 0) { found = true; break; }
      }
      if (found) { streak++; check.setDate(check.getDate() - 1); }
      else break;
    }
    return streak;
  }

  function getWeeklyXp(weekOffset) {
    var now = new Date();
    var weekStart = getWeekStart(now);
    weekStart.setDate(weekStart.getDate() + (weekOffset * 7));
    var weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    var xp = 0;
    // From focus sessions
    var sessions = focusSessions.filter(function (s) {
      var d = new Date(s.startTime || s.endTime);
      return d >= weekStart && d < weekEnd;
    });
    xp += sessions.length * 100;

    // From completed tasks
    var completed = tasks.filter(function (t) {
      if (!t.completed || !t.completedAt) return false;
      var d = new Date(t.completedAt);
      return d >= weekStart && d < weekEnd;
    });
    xp += completed.length * 50;

    // From check-ins
    var checkins = moodEntries.filter(function (m) {
      var d = new Date(m.date);
      return d >= weekStart && d < weekEnd;
    });
    xp += checkins.length * 25;

    return xp;
  }

  async function checkAndAwardAchievements() {
    var existing = xpData.achievements || [];
    var changed = false;
    for (var i = 0; i < ACHIEVEMENTS.length; i++) {
      var a = ACHIEVEMENTS[i];
      var alreadyHas = existing.indexOf(a.id) !== -1;
      if (!alreadyHas && a.check()) {
        existing.push(a.id);
        changed = true;
      }
    }
    if (changed) {
      xpData.achievements = existing;
      await window.EthanOSData.saveData('xp', xpData);
    }
  }

  /* ========================================================================
     RENDER
     ======================================================================== */
  function render() {
    var totalXp = xpData.totalXp || 0;
    var info = getCurrentLevel(totalXp);
    var current = info.current;
    var next = info.next;

    // Level display
    var progressPct = 100;
    var progressText = 'MAX LEVEL';
    if (next) {
      var range = next.xp - current.xp;
      var progress = totalXp - current.xp;
      progressPct = range > 0 ? Math.min(100, Math.round((progress / range) * 100)) : 100;
      progressText = totalXp + ' / ' + next.xp + ' XP';
    }

    var levelIdx = 0;
    for (var li = 0; li < LEVELS.length; li++) {
      if (LEVELS[li].name === current.name) { levelIdx = li; break; }
    }

    document.getElementById('level-display').innerHTML =
      '<div class="level-icon">' + current.icon + '</div>' +
      '<div class="level-name">Level ' + (levelIdx + 1) + ' — ' + current.name + '</div>' +
      '<div class="level-xp">' + totalXp.toLocaleString() + ' XP</div>' +
      '<div class="xp-bar-wrapper">' +
        '<div class="progress-label">' +
          '<span class="progress-label-name">' + (next ? 'Next: ' + next.name : 'Max Level') + '</span>' +
          '<span class="progress-label-value">' + progressText + '</span>' +
        '</div>' +
        createProgressBar(progressPct) +
      '</div>';

    // Stats row
    var thisWeekXp = getWeeklyXp(0);
    var lastWeekXp = getWeeklyXp(-1);
    var diff = thisWeekXp - lastWeekXp;
    var unlockedCount = (xpData.achievements || []).length;

    document.getElementById('stats-row').innerHTML =
      '<div class="card stat-card">' +
        '<div class="stat-number accent">' + totalXp.toLocaleString() + '</div>' +
        '<div class="stat-label">Total XP</div>' +
      '</div>' +
      '<div class="card stat-card">' +
        '<div class="stat-number">' + thisWeekXp + '</div>' +
        '<div class="stat-label">This Week</div>' +
      '</div>' +
      '<div class="card stat-card">' +
        '<div class="stat-number ' + (diff >= 0 ? 'success' : 'danger') + '">' + (diff >= 0 ? '+' : '') + diff + '</div>' +
        '<div class="stat-label">vs Last Week</div>' +
      '</div>' +
      '<div class="card stat-card">' +
        '<div class="stat-number">' + unlockedCount + '/' + ACHIEVEMENTS.length + '</div>' +
        '<div class="stat-label">Achievements</div>' +
      '</div>';

    // Weekly comparison
    var compHTML = '';
    var maxWeekXp = Math.max(thisWeekXp, lastWeekXp, 1);
    compHTML += '<div style="margin-bottom:var(--space-md)">' +
      '<div class="flex-between mb-1"><span class="text-sm font-bold">This Week</span><span class="text-sm text-accent">' + thisWeekXp + ' XP</span></div>' +
      '<div class="progress-bar"><div class="progress-bar-fill" style="width:' + ((thisWeekXp / maxWeekXp) * 100) + '%"></div></div>' +
    '</div>';
    compHTML += '<div>' +
      '<div class="flex-between mb-1"><span class="text-sm font-bold">Last Week</span><span class="text-sm text-secondary">' + lastWeekXp + ' XP</span></div>' +
      '<div class="progress-bar"><div class="progress-bar-fill" style="width:' + ((lastWeekXp / maxWeekXp) * 100) + '%;opacity:0.5"></div></div>' +
    '</div>';
    if (diff > 0) {
      compHTML += '<p class="text-sm text-success mt-2">Up ' + diff + ' XP from last week!</p>';
    } else if (diff < 0) {
      compHTML += '<p class="text-sm text-danger mt-2">Down ' + Math.abs(diff) + ' XP from last week.</p>';
    } else {
      compHTML += '<p class="text-sm text-muted mt-2">Same as last week.</p>';
    }
    document.getElementById('weekly-comparison').innerHTML = compHTML;

    // Achievement count
    document.getElementById('achievement-count').textContent = unlockedCount + ' / ' + ACHIEVEMENTS.length + ' unlocked';

    // Achievement grid
    var gridHTML = '';
    for (var i = 0; i < ACHIEVEMENTS.length; i++) {
      var a = ACHIEVEMENTS[i];
      var unlocked = (xpData.achievements || []).indexOf(a.id) !== -1;
      gridHTML += '<div class="achievement-card ' + (unlocked ? 'unlocked' : 'locked') + '">' +
        '<div class="achievement-icon">' + a.icon + '</div>' +
        '<div class="achievement-name">' + a.name + '</div>' +
        '<div class="achievement-desc">' + a.desc + '</div>' +
        (unlocked ? '<div class="badge badge-success mt-1" style="display:inline-flex">Unlocked</div>' : '<div class="badge badge-muted mt-1" style="display:inline-flex">Locked</div>') +
      '</div>';
    }
    document.getElementById('achievement-grid').innerHTML = gridHTML;
  }

})();
