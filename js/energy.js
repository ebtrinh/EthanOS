/**
 * EthanOS — Energy & Mood Tracking
 */
(async function () {
  'use strict';

  // Wait for shared.js boot
  await new Promise(function (resolve) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(resolve, 50);
    } else {
      document.addEventListener('DOMContentLoaded', function () { setTimeout(resolve, 50); });
    }
  });

  var moodEntries = await window.EthanOSData.loadData('moodEntries', []);

  // ---- Helpers ----
  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function getTodayEntry() {
    var today = todayStr();
    for (var i = 0; i < moodEntries.length; i++) {
      if (moodEntries[i].date === today) return moodEntries[i];
    }
    return null;
  }

  function getLast(n) {
    var sorted = moodEntries.slice().sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
    return sorted.slice(-n);
  }

  function getStreak() {
    var sorted = moodEntries.slice().sort(function (a, b) {
      return a.date > b.date ? -1 : a.date < b.date ? 1 : 0;
    });
    if (sorted.length === 0) return 0;
    var streak = 0;
    var d = new Date();
    for (var i = 0; i < sorted.length; i++) {
      var expected = new Date(d);
      expected.setDate(expected.getDate() - i);
      var expStr = expected.toISOString().slice(0, 10);
      if (sorted[i].date === expStr) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  // ---- Render Stats ----
  function renderStats() {
    var el = document.getElementById('energy-stats');
    if (!el) return;
    var streak = getStreak();
    var last7 = getLast(7);
    var avgEnergy = 0, avgStress = 0, avgSleep = 0;
    if (last7.length > 0) {
      var sumE = 0, sumS = 0, sumSl = 0;
      for (var i = 0; i < last7.length; i++) {
        sumE += last7[i].energy || 0;
        sumS += last7[i].stress || 0;
        sumSl += last7[i].sleep || 0;
      }
      avgEnergy = (sumE / last7.length).toFixed(1);
      avgStress = (sumS / last7.length).toFixed(1);
      avgSleep = (sumSl / last7.length).toFixed(1);
    }

    el.innerHTML =
      '<div class="card stat-card"><div class="stat-number accent">' + streak + '</div><div class="stat-label">Day Streak</div></div>' +
      '<div class="card stat-card"><div class="stat-number success">' + avgEnergy + '</div><div class="stat-label">Avg Energy (7d)</div></div>' +
      '<div class="card stat-card"><div class="stat-number warning">' + avgStress + '</div><div class="stat-label">Avg Stress (7d)</div></div>' +
      '<div class="card stat-card"><div class="stat-number">' + avgSleep + 'h</div><div class="stat-label">Avg Sleep (7d)</div></div>';
  }

  // ---- Render Check-in Form ----
  function renderCheckinForm() {
    var container = document.getElementById('checkin-form-container');
    var statusBadge = document.getElementById('checkin-status');
    if (!container) return;

    var existing = getTodayEntry();
    if (statusBadge) {
      statusBadge.textContent = existing ? 'Completed today' : 'Not yet';
      statusBadge.className = existing ? 'badge badge-success' : 'badge badge-warning';
    }

    var energy = existing ? existing.energy : 5;
    var stress = existing ? existing.stress : 5;
    var sleep = existing ? existing.sleep : 7;
    var workout = existing ? existing.workout : false;
    var notes = existing ? (existing.notes || '') : '';

    container.innerHTML =
      '<div class="grid-2">' +
        '<div class="form-group">' +
          '<label class="form-label">Energy Level: <span id="energy-val">' + energy + '</span>/10</label>' +
          '<input type="range" min="1" max="10" value="' + energy + '" id="energy-slider" style="width:100%;accent-color:var(--success)">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Stress Level: <span id="stress-val">' + stress + '</span>/10</label>' +
          '<input type="range" min="1" max="10" value="' + stress + '" id="stress-slider" style="width:100%;accent-color:var(--warning)">' +
        '</div>' +
      '</div>' +
      '<div class="grid-2">' +
        '<div class="form-group">' +
          '<label class="form-label">Sleep Hours</label>' +
          '<input type="number" id="sleep-input" min="0" max="24" step="0.5" value="' + sleep + '">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Workout Today?</label>' +
          '<label class="toggle" style="margin-top:6px">' +
            '<input type="checkbox" id="workout-toggle"' + (workout ? ' checked' : '') + '>' +
            '<span class="toggle-slider"></span>' +
          '</label>' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Notes (optional)</label>' +
        '<textarea id="checkin-notes" rows="2" placeholder="How are you feeling?">' + notes + '</textarea>' +
      '</div>' +
      '<button class="btn btn-primary" id="save-checkin-btn">' + (existing ? 'Update Check-in' : 'Save Check-in') + '</button>';

    // Slider labels
    document.getElementById('energy-slider').addEventListener('input', function () {
      document.getElementById('energy-val').textContent = this.value;
    });
    document.getElementById('stress-slider').addEventListener('input', function () {
      document.getElementById('stress-val').textContent = this.value;
    });

    // Save
    document.getElementById('save-checkin-btn').addEventListener('click', saveCheckin);
  }

  async function saveCheckin() {
    var energy = parseInt(document.getElementById('energy-slider').value);
    var stress = parseInt(document.getElementById('stress-slider').value);
    var sleep = parseFloat(document.getElementById('sleep-input').value) || 0;
    var workout = document.getElementById('workout-toggle').checked;
    var notes = document.getElementById('checkin-notes').value.trim();

    var today = todayStr();
    var existing = getTodayEntry();

    if (existing) {
      existing.energy = energy;
      existing.stress = stress;
      existing.sleep = sleep;
      existing.workout = workout;
      existing.notes = notes;
    } else {
      moodEntries.push({
        id: generateId(),
        date: today,
        energy: energy,
        stress: stress,
        sleep: sleep,
        workout: workout,
        notes: notes
      });
      await awardXP(25, 'Daily check-in');
    }

    await window.EthanOSData.saveData('moodEntries', moodEntries);
    showToast(existing ? 'Check-in updated' : 'Check-in saved!', 'success');
    renderAll();
  }

  // ---- Bar Chart Renderer ----
  function renderBarChart(containerId, entries, key, color) {
    var el = document.getElementById(containerId);
    if (!el) return;
    if (entries.length === 0) {
      el.innerHTML = '<p class="text-muted text-center">No data yet</p>';
      return;
    }

    var html = '<div style="display:flex;align-items:flex-end;gap:4px;height:140px">';
    for (var i = 0; i < entries.length; i++) {
      var val = entries[i][key] || 0;
      var pct = (val / 10) * 100;
      var dateLabel = entries[i].date.slice(5); // MM-DD
      html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;height:100%">' +
        '<div style="flex:1;width:100%;display:flex;align-items:flex-end">' +
          '<div style="width:100%;height:' + pct + '%;background:' + color + ';border-radius:4px 4px 0 0;min-height:2px;transition:height 0.3s" title="' + val + '"></div>' +
        '</div>' +
        '<span class="text-xs text-muted" style="margin-top:4px;white-space:nowrap">' + dateLabel + '</span>' +
      '</div>';
    }
    html += '</div>';
    el.innerHTML = html;
  }

  // ---- Sleep Trend ----
  function renderSleepTrend() {
    var el = document.getElementById('sleep-chart');
    if (!el) return;
    var entries = getLast(14);
    if (entries.length === 0) {
      el.innerHTML = '<p class="text-muted text-center">No data yet</p>';
      return;
    }

    var maxSleep = 12;
    var html = '<div style="display:flex;align-items:flex-end;gap:4px;height:120px">';
    for (var i = 0; i < entries.length; i++) {
      var val = entries[i].sleep || 0;
      var pct = Math.min((val / maxSleep) * 100, 100);
      var color = val < 6 ? 'var(--danger)' : val < 7 ? 'var(--warning)' : 'var(--accent)';
      var dateLabel = entries[i].date.slice(5);
      html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;height:100%">' +
        '<span class="text-xs" style="color:var(--text-secondary);margin-bottom:2px">' + val + 'h</span>' +
        '<div style="flex:1;width:100%;display:flex;align-items:flex-end">' +
          '<div style="width:100%;height:' + pct + '%;background:' + color + ';border-radius:4px 4px 0 0;min-height:2px"></div>' +
        '</div>' +
        '<span class="text-xs text-muted" style="margin-top:4px">' + dateLabel + '</span>' +
      '</div>';
    }
    html += '</div>';
    el.innerHTML = html;
  }

  // ---- Insights ----
  function renderInsights() {
    var el = document.getElementById('insights-container');
    if (!el) return;
    var entries = getLast(14);
    if (entries.length < 3) {
      el.innerHTML = '<p class="text-muted">Need at least 3 check-ins for insights.</p>';
      return;
    }

    var insights = [];

    // Workout vs energy correlation
    var workoutDays = entries.filter(function (e) { return e.workout; });
    var restDays = entries.filter(function (e) { return !e.workout; });
    if (workoutDays.length > 0 && restDays.length > 0) {
      var avgEW = 0, avgER = 0;
      for (var i = 0; i < workoutDays.length; i++) avgEW += workoutDays[i].energy;
      avgEW /= workoutDays.length;
      for (var j = 0; j < restDays.length; j++) avgER += restDays[j].energy;
      avgER /= restDays.length;
      if (avgEW > avgER + 0.5) {
        insights.push('Your energy is <strong>' + (avgEW - avgER).toFixed(1) + ' points higher</strong> on workout days.');
      } else if (avgER > avgEW + 0.5) {
        insights.push('Your energy is slightly higher on rest days. You might be overtraining.');
      }
    }

    // Sleep vs energy correlation
    var goodSleep = entries.filter(function (e) { return e.sleep >= 7; });
    var badSleep = entries.filter(function (e) { return e.sleep < 7; });
    if (goodSleep.length > 0 && badSleep.length > 0) {
      var avgGS = 0, avgBS = 0;
      for (var k = 0; k < goodSleep.length; k++) avgGS += goodSleep[k].energy;
      avgGS /= goodSleep.length;
      for (var l = 0; l < badSleep.length; l++) avgBS += badSleep[l].energy;
      avgBS /= badSleep.length;
      if (avgGS > avgBS + 0.5) {
        insights.push('You have <strong>' + (avgGS - avgBS).toFixed(1) + ' more energy</strong> when sleeping 7+ hours.');
      }
    }

    // Stress trend
    if (entries.length >= 7) {
      var recent3 = entries.slice(-3);
      var older3 = entries.slice(-7, -4);
      if (older3.length > 0) {
        var avgRecent = 0, avgOlder = 0;
        for (var m = 0; m < recent3.length; m++) avgRecent += recent3[m].stress;
        avgRecent /= recent3.length;
        for (var n = 0; n < older3.length; n++) avgOlder += older3[n].stress;
        avgOlder /= older3.length;
        if (avgRecent > avgOlder + 1) {
          insights.push('Your stress has been <strong>rising</strong> over the last few days. Consider scheduling a break.');
        } else if (avgRecent < avgOlder - 1) {
          insights.push('Your stress is <strong>trending down</strong>. Keep up the good habits!');
        }
      }
    }

    if (insights.length === 0) {
      insights.push('Keep checking in! More data will unlock better insights.');
    }

    var html = '';
    for (var p = 0; p < insights.length; p++) {
      html += '<div class="list-item"><span style="font-size:1.2rem;margin-right:8px">💡</span><span>' + insights[p] + '</span></div>';
    }
    el.innerHTML = html;
  }

  // ---- Render All ----
  function renderAll() {
    renderStats();
    renderCheckinForm();
    var last14 = getLast(14);
    renderBarChart('energy-chart', last14, 'energy', 'var(--success)');
    renderBarChart('stress-chart', last14, 'stress', 'var(--warning)');
    renderSleepTrend();
    renderInsights();
  }

  renderAll();
})();
