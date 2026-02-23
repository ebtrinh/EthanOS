/**
 * EthanOS — Burnout Monitor
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

  var moodEntries = await window.EthanOSData.loadData('moodEntries', []);
  var tasks = await window.EthanOSData.loadData('tasks', []);
  var focusSessions = await window.EthanOSData.loadData('focusSessions', []);
  var schedule = await window.EthanOSData.loadData('schedule', []);

  // ---- Helpers ----
  function getLast7Moods() {
    var sorted = moodEntries.slice().sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
    return sorted.slice(-7);
  }

  function daysAgo(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  // ---- Compute Risk Factors ----
  function computeFactors() {
    var factors = {};

    // 1. Consecutive heavy days (8+ hours of focus/schedule)
    var heavyDays = 0;
    for (var d = 0; d < 7; d++) {
      var dayStr = daysAgo(d);
      var dayHours = 0;
      for (var f = 0; f < focusSessions.length; f++) {
        var sDate = (focusSessions[f].startTime || focusSessions[f].endTime || '').slice(0, 10);
        if (sDate === dayStr) dayHours += (focusSessions[f].duration || 0) / 60;
      }
      if (dayHours >= 8) heavyDays++;
      else if (d > 0) break; // only count consecutive from today
    }
    factors.heavyDays = {
      label: 'Consecutive Heavy Days',
      value: heavyDays,
      max: 7,
      risk: heavyDays >= 5 ? 3 : heavyDays >= 3 ? 2 : heavyDays >= 1 ? 1 : 0,
      description: heavyDays + ' day(s) with 8+ hours of work in a row'
    };

    // 2. Sleep trend
    var last7 = getLast7Moods();
    var avgSleep = 0;
    if (last7.length > 0) {
      var sumSleep = 0;
      for (var s = 0; s < last7.length; s++) sumSleep += last7[s].sleep || 0;
      avgSleep = sumSleep / last7.length;
    }
    factors.sleep = {
      label: 'Sleep Trend',
      value: avgSleep.toFixed(1) + 'h avg',
      max: 10,
      risk: avgSleep < 5 ? 3 : avgSleep < 6 ? 2 : avgSleep < 7 ? 1 : 0,
      description: avgSleep < 6 ? 'Dangerously low sleep' : avgSleep < 7 ? 'Below recommended 7h' : 'Sleep is adequate'
    };

    // 3. Stress trend
    var avgStress = 0;
    if (last7.length > 0) {
      var sumStress = 0;
      for (var st = 0; st < last7.length; st++) sumStress += last7[st].stress || 0;
      avgStress = sumStress / last7.length;
    }
    factors.stress = {
      label: 'Stress Trend',
      value: avgStress.toFixed(1) + '/10',
      max: 10,
      risk: avgStress >= 8 ? 3 : avgStress >= 6 ? 2 : avgStress >= 4 ? 1 : 0,
      description: avgStress >= 8 ? 'Critical stress levels' : avgStress >= 6 ? 'Elevated stress' : 'Stress under control'
    };

    // 4. Overdue tasks
    var overdueCount = 0;
    var today = new Date().toISOString().slice(0, 10);
    for (var t = 0; t < tasks.length; t++) {
      if (!tasks[t].completed && tasks[t].dueDate && tasks[t].dueDate < today) {
        overdueCount++;
      }
    }
    factors.overdue = {
      label: 'Overdue Tasks',
      value: overdueCount,
      max: 10,
      risk: overdueCount >= 5 ? 3 : overdueCount >= 3 ? 2 : overdueCount >= 1 ? 1 : 0,
      description: overdueCount === 0 ? 'All caught up!' : overdueCount + ' task(s) past due'
    };

    // 5. Rest days in last 7
    var restDays = 0;
    for (var rd = 0; rd < 7; rd++) {
      var rdStr = daysAgo(rd);
      var dayWork = 0;
      for (var rf = 0; rf < focusSessions.length; rf++) {
        var rDate = (focusSessions[rf].startTime || focusSessions[rf].endTime || '').slice(0, 10);
        if (rDate === rdStr) dayWork += (focusSessions[rf].duration || 0) / 60;
      }
      if (dayWork < 1) restDays++;
    }
    factors.restDays = {
      label: 'Rest Days (Last 7)',
      value: restDays,
      max: 7,
      risk: restDays === 0 ? 3 : restDays === 1 ? 2 : restDays < 2 ? 1 : 0,
      description: restDays === 0 ? 'No rest days! Take a break!' : restDays + ' rest day(s) in the last week'
    };

    return factors;
  }

  // ---- Overall Risk Level ----
  function computeOverallRisk(factors) {
    var totalRisk = 0;
    var keys = Object.keys(factors);
    for (var i = 0; i < keys.length; i++) totalRisk += factors[keys[i]].risk;
    var maxRisk = keys.length * 3;
    var pct = (totalRisk / maxRisk) * 100;

    if (pct >= 70) return { level: 'Critical', color: 'var(--danger)', badge: 'badge-danger', pct: pct };
    if (pct >= 45) return { level: 'High', color: 'var(--warning)', badge: 'badge-warning', pct: pct };
    if (pct >= 20) return { level: 'Medium', color: 'var(--cat-orange)', badge: 'badge-warning', pct: pct };
    return { level: 'Low', color: 'var(--success)', badge: 'badge-success', pct: pct };
  }

  // ---- Render Risk Meter ----
  function renderRiskMeter(overall) {
    var el = document.getElementById('risk-meter');
    if (!el) return;

    el.innerHTML =
      '<div style="text-align:center;margin-bottom:var(--space-lg)">' +
        '<span class="badge badge-lg ' + overall.badge + '" style="font-size:var(--font-size-lg);padding:8px 24px">' + overall.level + ' Risk</span>' +
      '</div>' +
      '<div style="position:relative;height:24px;border-radius:12px;overflow:hidden;background:linear-gradient(to right, var(--success), var(--cat-orange), var(--danger))">' +
        '<div style="position:absolute;left:' + overall.pct + '%;top:-4px;bottom:-4px;width:4px;background:white;border-radius:2px;box-shadow:0 0 8px rgba(255,255,255,0.5);transform:translateX(-50%)"></div>' +
      '</div>' +
      '<div class="flex-between mt-1">' +
        '<span class="text-xs text-success">Low</span>' +
        '<span class="text-xs text-warning">Medium</span>' +
        '<span class="text-xs text-danger">Critical</span>' +
      '</div>';
  }

  // ---- Render Factor Cards ----
  function renderFactorCards(factors) {
    var el = document.getElementById('factor-cards');
    if (!el) return;

    var html = '';
    var keys = Object.keys(factors);
    for (var i = 0; i < keys.length; i++) {
      var f = factors[keys[i]];
      var riskColors = ['var(--success)', 'var(--cat-orange)', 'var(--warning)', 'var(--danger)'];
      var riskLabels = ['OK', 'Watch', 'Warning', 'Critical'];
      var riskColor = riskColors[f.risk];
      var riskLabel = riskLabels[f.risk];

      html +=
        '<div class="card">' +
          '<div class="card-header">' +
            '<h3 class="card-title" style="font-size:var(--font-size-md)">' + f.label + '</h3>' +
            '<span class="badge" style="background:' + riskColor + '20;color:' + riskColor + '">' + riskLabel + '</span>' +
          '</div>' +
          '<div class="card-body">' +
            '<div class="stat-number" style="font-size:var(--font-size-xl);color:' + riskColor + '">' + f.value + '</div>' +
            '<p class="text-sm text-secondary mt-1">' + f.description + '</p>' +
          '</div>' +
        '</div>';
    }

    el.innerHTML = html;
  }

  // ---- Render Stress Mini Chart ----
  function renderStressMiniChart() {
    var el = document.getElementById('stress-mini-chart');
    if (!el) return;

    var last7 = getLast7Moods();
    if (last7.length === 0) {
      el.innerHTML = '<p class="text-muted text-center">No mood data for the last 7 days</p>';
      return;
    }

    var html = '<div style="display:flex;align-items:flex-end;gap:6px;height:100px">';
    for (var i = 0; i < last7.length; i++) {
      var val = last7[i].stress || 0;
      var pct = (val / 10) * 100;
      var color = val >= 8 ? 'var(--danger)' : val >= 5 ? 'var(--warning)' : 'var(--success)';
      var dateLabel = last7[i].date.slice(5);
      html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;height:100%">' +
        '<span class="text-xs" style="color:var(--text-secondary);margin-bottom:2px">' + val + '</span>' +
        '<div style="flex:1;width:100%;display:flex;align-items:flex-end">' +
          '<div style="width:100%;height:' + pct + '%;background:' + color + ';border-radius:4px 4px 0 0;min-height:2px"></div>' +
        '</div>' +
        '<span class="text-xs text-muted" style="margin-top:4px">' + dateLabel + '</span>' +
      '</div>';
    }
    html += '</div>';
    el.innerHTML = html;
  }

  // ---- Render Recommendations ----
  function renderRecommendations(factors) {
    var el = document.getElementById('recommendations');
    if (!el) return;

    var recs = [];

    if (factors.heavyDays.risk >= 2) {
      recs.push({ icon: '🛌', text: 'You\'ve been working intensely for ' + factors.heavyDays.value + ' days straight. Schedule a light day or rest day tomorrow.' });
    }
    if (factors.sleep.risk >= 2) {
      recs.push({ icon: '😴', text: 'Your sleep is below 6 hours on average. Prioritize getting to bed earlier tonight.' });
    } else if (factors.sleep.risk === 1) {
      recs.push({ icon: '🌙', text: 'Aim for 7+ hours of sleep. Small improvements compound over time.' });
    }
    if (factors.stress.risk >= 2) {
      recs.push({ icon: '🧘', text: 'Stress levels are elevated. Consider a short meditation, walk, or break between tasks.' });
    }
    if (factors.overdue.risk >= 1) {
      recs.push({ icon: '📋', text: 'You have ' + factors.overdue.value + ' overdue task(s). Knock out the smallest one first to build momentum.' });
    }
    if (factors.restDays.risk >= 2) {
      recs.push({ icon: '☀️', text: 'You haven\'t had enough rest days. Block off time for recovery — it boosts long-term productivity.' });
    }

    if (recs.length === 0) {
      recs.push({ icon: '✅', text: 'All indicators look healthy! Keep maintaining your current balance.' });
    }

    var html = '';
    for (var r = 0; r < recs.length; r++) {
      html += '<div class="list-item"><span style="font-size:1.2rem;margin-right:8px">' + recs[r].icon + '</span><span>' + recs[r].text + '</span></div>';
    }
    el.innerHTML = html;
  }

  // ---- Render All ----
  var factors = computeFactors();
  var overall = computeOverallRisk(factors);

  renderRiskMeter(overall);
  renderFactorCards(factors);
  renderStressMiniChart();
  renderRecommendations(factors);

})();
