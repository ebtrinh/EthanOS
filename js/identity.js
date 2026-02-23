/**
 * EthanOS — Identity System
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

  var statements = await window.EthanOSData.loadData('identity', []);
  var goals = await window.EthanOSData.loadData('goals', []);

  // ---- Add Statement Button ----
  document.getElementById('add-statement-btn').addEventListener('click', function () {
    openStatementModal(null);
  });

  // ---- Daily Spotlight ----
  function renderSpotlight() {
    var el = document.getElementById('spotlight-content');
    if (!el) return;
    if (statements.length === 0) {
      el.innerHTML = '<p class="text-muted">Add identity statements to see your daily spotlight</p>';
      return;
    }

    // Use date as seed for deterministic daily selection
    var today = new Date().toISOString().slice(0, 10);
    var seed = 0;
    for (var i = 0; i < today.length; i++) seed += today.charCodeAt(i);
    var idx = seed % statements.length;
    var stmt = statements[idx];
    var cat = getCategoryById(stmt.categoryId);

    el.innerHTML =
      '<div style="font-size:var(--font-size-xl);font-weight:700;color:var(--text-primary);margin-bottom:var(--space-md)">' +
        '"You are becoming someone who ' + escapeHTML(stmt.statement) + '"' +
      '</div>' +
      (cat ? '<div>' + getCategoryBadgeHTML(stmt.categoryId) + '</div>' : '');
  }

  // ---- Render Statements List ----
  function renderStatements() {
    var el = document.getElementById('statements-list');
    if (!el) return;

    if (statements.length === 0) {
      el.innerHTML = '<div class="empty-state span-full"><div class="empty-state-icon">🧬</div><div class="empty-state-title">No identity statements yet</div><div class="empty-state-text">Define who you are becoming by adding statements.</div></div>';
      return;
    }

    var html = '';
    for (var i = 0; i < statements.length; i++) {
      var s = statements[i];
      var cat = getCategoryById(s.categoryId);

      // Find linked goals
      var linkedGoals = goals.filter(function (g) { return g.categoryId === s.categoryId; });
      var goalsHTML = '';
      if (linkedGoals.length > 0) {
        for (var g = 0; g < linkedGoals.length; g++) {
          var goal = linkedGoals[g];
          goalsHTML +=
            '<div style="margin-top:var(--space-sm)">' +
              '<div class="progress-label"><span class="progress-label-name">' + escapeHTML(goal.title) + '</span><span class="progress-label-value">' + (goal.progress || 0) + '%</span></div>' +
              createProgressBar(goal.progress || 0, 'success') +
            '</div>';
        }
      } else {
        goalsHTML = '<p class="text-xs text-muted" style="margin-top:var(--space-sm)">No linked goals</p>';
      }

      html +=
        '<div class="card">' +
          '<div class="card-header">' +
            '<div>' +
              (cat ? getCategoryBadgeHTML(s.categoryId) : '<span class="badge badge-muted">No category</span>') +
            '</div>' +
            '<div class="btn-group">' +
              '<button class="btn btn-ghost btn-sm stmt-edit" data-id="' + s.id + '">Edit</button>' +
              '<button class="btn btn-ghost btn-sm text-danger stmt-delete" data-id="' + s.id + '">Delete</button>' +
            '</div>' +
          '</div>' +
          '<div class="card-body">' +
            '<p style="font-size:var(--font-size-md);font-weight:600;color:var(--text-primary)">"You are becoming someone who ' + escapeHTML(s.statement) + '"</p>' +
            goalsHTML +
          '</div>' +
        '</div>';
    }

    el.innerHTML = html;

    // Attach handlers
    var editBtns = el.querySelectorAll('.stmt-edit');
    for (var e = 0; e < editBtns.length; e++) {
      editBtns[e].addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        var stmt = statements.find(function (s) { return s.id === id; });
        if (stmt) openStatementModal(stmt);
      });
    }

    var deleteBtns = el.querySelectorAll('.stmt-delete');
    for (var d = 0; d < deleteBtns.length; d++) {
      deleteBtns[d].addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        deleteStatement(id);
      });
    }
  }

  // ---- Statement Modal ----
  function openStatementModal(stmt) {
    var isEdit = !!stmt;
    var cats = getAllCategories();

    var catOptions = '<option value="">-- None --</option>';
    for (var c = 0; c < cats.length; c++) {
      var sel = (stmt && stmt.categoryId === cats[c].id) ? ' selected' : '';
      catOptions += '<option value="' + cats[c].id + '"' + sel + '>' + cats[c].icon + ' ' + cats[c].name + '</option>';
    }

    var html =
      '<div class="form-group">' +
        '<label class="form-label">You are becoming someone who...</label>' +
        '<textarea id="stmt-text" rows="3" placeholder="e.g., studies consistently every day">' + (stmt ? stmt.statement : '') + '</textarea>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Category</label>' +
        '<select id="stmt-cat">' + catOptions + '</select>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;gap:var(--space-sm);margin-top:var(--space-lg)">' +
        '<button class="btn" onclick="closeModal()">Cancel</button>' +
        '<button class="btn btn-primary" id="stmt-save-btn">' + (isEdit ? 'Update' : 'Add Statement') + '</button>' +
      '</div>';

    openModal(isEdit ? 'Edit Statement' : 'Add Identity Statement', html);

    document.getElementById('stmt-save-btn').addEventListener('click', async function () {
      var text = document.getElementById('stmt-text').value.trim();
      if (!text) { showToast('Statement is required', 'warning'); return; }
      var catId = document.getElementById('stmt-cat').value;

      if (isEdit) {
        stmt.statement = text;
        stmt.categoryId = catId;
      } else {
        statements.push({
          id: generateId(),
          statement: text,
          categoryId: catId
        });
      }

      await window.EthanOSData.saveData('identity', statements);
      showToast(isEdit ? 'Statement updated' : 'Statement added', 'success');
      closeModal();
      renderAll();
    });
  }

  async function deleteStatement(id) {
    statements = statements.filter(function (s) { return s.id !== id; });
    await window.EthanOSData.saveData('identity', statements);
    showToast('Statement deleted', 'info');
    renderAll();
  }

  // ---- Escape HTML ----
  function escapeHTML(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ---- Render All ----
  function renderAll() {
    renderSpotlight();
    renderStatements();
  }

  renderAll();
})();
