/**
 * EthanOS — Life Balance
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

  var categories = getAllCategories();
  var focusSessions = await window.EthanOSData.loadData('focusSessions', []);
  var schedule = await window.EthanOSData.loadData('schedule', []);

  // ---- Compute actual hours this week per category ----
  function getActualHoursThisWeek() {
    var now = new Date();
    var dayOfWeek = now.getDay(); // 0=Sun
    var weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);

    var hours = {};
    for (var c = 0; c < categories.length; c++) hours[categories[c].id] = 0;

    // From focus sessions
    for (var f = 0; f < focusSessions.length; f++) {
      var s = focusSessions[f];
      var sDate = new Date(s.startTime || s.endTime);
      if (sDate >= weekStart && s.categoryId && hours[s.categoryId] !== undefined) {
        hours[s.categoryId] += (s.duration || 0) / 60;
      }
    }

    // From schedule (recurring blocks)
    for (var sc = 0; sc < schedule.length; sc++) {
      var blk = schedule[sc];
      if (!blk.categoryId || hours[blk.categoryId] === undefined) continue;
      if (blk.startTime && blk.endTime) {
        var start = new Date(blk.startTime);
        var end = new Date(blk.endTime);
        if (start >= weekStart) {
          hours[blk.categoryId] += (end - start) / (1000 * 60 * 60);
        }
      }
    }

    return hours;
  }

  // ---- Balance Score ----
  function computeBalanceScore(actualHours) {
    if (categories.length === 0) return 0;
    var totalDeviation = 0;
    var totalTarget = 0;

    for (var c = 0; c < categories.length; c++) {
      var target = categories[c].weeklyHoursTarget || 0;
      var actual = actualHours[categories[c].id] || 0;
      totalTarget += target;
      if (target > 0) {
        var ratio = actual / target;
        totalDeviation += Math.abs(1 - ratio);
      }
    }

    if (categories.length === 0) return 100;
    var avgDeviation = totalDeviation / categories.length;
    var score = Math.max(0, Math.round((1 - avgDeviation) * 100));
    return Math.min(100, score);
  }

  // ---- Render Balance Score ----
  function renderScore(score) {
    var el = document.getElementById('balance-score');
    if (el) el.textContent = score;

    var card = document.getElementById('balance-score-card');
    if (card) {
      var numEl = card.querySelector('.stat-number');
      if (numEl) {
        numEl.className = 'stat-number';
        if (score >= 75) numEl.classList.add('success');
        else if (score >= 50) numEl.classList.add('warning');
        else numEl.classList.add('danger');
      }
    }
  }

  // ---- Render Donut Chart ----
  function renderDonut(actualHours) {
    var el = document.getElementById('donut-chart');
    if (!el) return;

    var totalActual = 0;
    for (var c = 0; c < categories.length; c++) totalActual += actualHours[categories[c].id] || 0;

    if (totalActual === 0) {
      el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%"><span class="text-muted">No data</span></div>';
      return;
    }

    var gradientParts = [];
    var cumPct = 0;
    for (var i = 0; i < categories.length; i++) {
      var cat = categories[i];
      var pct = ((actualHours[cat.id] || 0) / totalActual) * 100;
      if (pct > 0) {
        var color = getCategoryColor(cat.id);
        gradientParts.push(color + ' ' + cumPct + '% ' + (cumPct + pct) + '%');
        cumPct += pct;
      }
    }

    if (gradientParts.length === 0) {
      el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%"><span class="text-muted">No data</span></div>';
      return;
    }

    el.style.background = 'conic-gradient(' + gradientParts.join(', ') + ')';
    el.innerHTML = '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:120px;height:120px;border-radius:50%;background:var(--bg-card);display:flex;align-items:center;justify-content:center;flex-direction:column">' +
      '<span style="font-size:var(--font-size-sm);color:var(--text-secondary)">Total</span>' +
      '<span style="font-size:var(--font-size-lg);font-weight:700;color:var(--text-primary)">' + totalActual.toFixed(1) + 'h</span>' +
    '</div>';
  }

  // ---- Render Bars ----
  function renderBars(actualHours) {
    var el = document.getElementById('balance-bars');
    if (!el) return;

    if (categories.length === 0) {
      el.innerHTML = '<p class="text-muted">No categories defined.</p>';
      return;
    }

    var maxHours = 0;
    for (var c = 0; c < categories.length; c++) {
      var target = categories[c].weeklyHoursTarget || 0;
      var actual = actualHours[categories[c].id] || 0;
      if (target > maxHours) maxHours = target;
      if (actual > maxHours) maxHours = actual;
    }
    if (maxHours === 0) maxHours = 1;

    var html = '';
    for (var i = 0; i < categories.length; i++) {
      var cat = categories[i];
      var target = cat.weeklyHoursTarget || 0;
      var actual = actualHours[cat.id] || 0;
      var targetPct = (target / maxHours) * 100;
      var actualPct = (actual / maxHours) * 100;
      var catColor = getCategoryColor(cat.id);

      // Warning badge
      var badge = '';
      if (target > 0) {
        var ratio = actual / target;
        if (ratio < 0.25) badge = '<span class="badge badge-danger" style="margin-left:8px">Neglected</span>';
        else if (ratio < 0.6) badge = '<span class="badge badge-warning" style="margin-left:8px">Below target</span>';
        else if (ratio > 1.5) badge = '<span class="badge" style="background:rgba(255,165,2,0.15);color:var(--cat-orange);margin-left:8px">Dominating</span>';
      }

      html +=
        '<div style="margin-bottom:var(--space-lg)">' +
          '<div class="flex-between mb-1">' +
            '<span style="font-weight:600">' + cat.icon + ' ' + cat.name + badge + '</span>' +
            '<span class="text-sm text-secondary">' + actual.toFixed(1) + 'h / ' + target + 'h</span>' +
          '</div>' +
          '<div style="display:flex;gap:4px;align-items:center">' +
            '<span class="text-xs text-muted" style="width:50px">Target</span>' +
            '<div style="flex:1;height:8px;background:var(--bg-primary);border-radius:4px;overflow:hidden">' +
              '<div style="width:' + targetPct + '%;height:100%;background:' + catColor + ';opacity:0.3;border-radius:4px"></div>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:4px;align-items:center;margin-top:3px">' +
            '<span class="text-xs text-muted" style="width:50px">Actual</span>' +
            '<div style="flex:1;height:8px;background:var(--bg-primary);border-radius:4px;overflow:hidden">' +
              '<div style="width:' + actualPct + '%;height:100%;background:' + catColor + ';border-radius:4px"></div>' +
            '</div>' +
          '</div>' +
        '</div>';
    }

    el.innerHTML = html;
  }

  // ---- Render Suggestions ----
  function renderSuggestions(actualHours) {
    var el = document.getElementById('balance-suggestions');
    if (!el) return;

    var suggestions = [];

    for (var i = 0; i < categories.length; i++) {
      var cat = categories[i];
      var target = cat.weeklyHoursTarget || 0;
      var actual = actualHours[cat.id] || 0;

      if (target > 0) {
        var ratio = actual / target;
        if (ratio < 0.25) {
          suggestions.push({
            icon: '🔴',
            text: '<strong>' + cat.name + '</strong> is severely neglected. Try scheduling at least ' + Math.ceil(target * 0.5) + 'h this week.'
          });
        } else if (ratio < 0.6) {
          suggestions.push({
            icon: '🟡',
            text: '<strong>' + cat.name + '</strong> is below target. Consider adding ' + (target - actual).toFixed(1) + ' more hours.'
          });
        } else if (ratio > 1.5) {
          suggestions.push({
            icon: '🟠',
            text: '<strong>' + cat.name + '</strong> is dominating your time. Consider redistributing ' + (actual - target).toFixed(1) + 'h to other areas.'
          });
        }
      }
    }

    if (suggestions.length === 0) {
      suggestions.push({ icon: '✅', text: 'Your life balance looks great! Keep maintaining your schedule.' });
    }

    var html = '';
    for (var s = 0; s < suggestions.length; s++) {
      html += '<div class="list-item"><span style="font-size:1.2rem;margin-right:8px">' + suggestions[s].icon + '</span><span>' + suggestions[s].text + '</span></div>';
    }
    el.innerHTML = html;
  }

  // ---- Render All ----
  var actualHours = getActualHoursThisWeek();
  var score = computeBalanceScore(actualHours);

  renderScore(score);
  renderDonut(actualHours);
  renderBars(actualHours);
  renderSuggestions(actualHours);

})();
